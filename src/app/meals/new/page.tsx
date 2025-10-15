'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'


type Profile = { user_id: string; timezone: string }
type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'

function looksLikeHeic(file: File) {
  const t = (file.type || '').toLowerCase()
  const n = (file.name || '').toLowerCase()
  return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif')
}

function formatStamp(date: Date, tz: string) {
  // "YYYYMMDD_HHmmss"
  return formatInTimeZone(date, tz, 'yyyyMMdd_HHmmss')
}

async function readExifDate(file: File): Promise<Date | null> {
  try {
    const { parse } = await import('exifr')  // ← ここでだけ読み込む
    // 取得したいキーを絞ると軽くなります
    const meta: any = await parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate']
    })
    return meta?.DateTimeOriginal ?? meta?.CreateDate ?? meta?.ModifyDate ?? null
  } catch {
    return null
  }
}

async function createImageBitmapSafe(src: Blob): Promise<ImageBitmap> {
  // 一部端末で HEIC の createImageBitmap が失敗するためフォールバック
  try {
    return await createImageBitmap(src)
  } catch {
    // HEIC → 一度 JPEG にしてから読み直す
    const { default: heic2any } = await import('heic2any')
    const jpeg = (await heic2any({ blob: src, toType: 'image/jpeg', quality: 0.9 })) as Blob
    return await createImageBitmap(jpeg)
  }
}

async function toJpeg(blobOrFile: Blob, quality = 0.9): Promise<Blob> {
  // リサイズなしで JPEG に“書きなおす”（形式統一）
  const bmp = await createImageBitmapSafe(blobOrFile)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  const out: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality))
  return out
}

async function toJpegPreview(blobOrFile: Blob, maxDim = 1024, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmapSafe(blobOrFile)
  const { width, height } = bmp
  const scale = Math.max(width, height) > maxDim ? maxDim / Math.max(width, height) : 1
  const tw = Math.round(width * scale)
  const th = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, tw, th)
  const out: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality))
  return out
}

export default function NewMealPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mealSlot, setMealSlot] = useState<MealSlot>('breakfast')
  const [takenLocal, setTakenLocal] = useState<string>('') // "YYYY-MM-DDTHH:MM"
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const cu = u.user as any
      setUser(cu ?? null)
      if (!cu) return

      const { data: p, error } = await supabase
        .from('profiles')
        .select('user_id, timezone')
        .eq('user_id', cu.id)
        .maybeSingle()
      if (error) setErr(error.message)
      else if (p) setProfile(p)

      // 既定の撮影時刻＝今（ローカル）
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const mi = String(now.getMinutes()).padStart(2, '0')
      setTakenLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`)
    })()
  }, [])

  const onFileChange = async (f: File | null) => {
    setFile(f)
    if (!f) return
    // EXIFの撮影日時があればフォームへ反映
    const tz = profile?.timezone ?? 'Asia/Tokyo'
    const exifDate = await readExifDate(f)
    if (exifDate) {
      const stamp = formatInTimeZone(exifDate, tz, "yyyy-MM-dd'T'HH:mm")
      setTakenLocal(stamp)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null); setErr(null)
    if (!user) return setErr('ログインが必要です。')
    if (!profile) return setErr('プロフィールを読み込めませんでした。')
    if (!file) return setErr('画像ファイルを選択してください。')
    if (!takenLocal) return setErr('撮影日時を入力してください。')

    try {
      setLoading(true)
      const timezone = profile.timezone || 'Asia/Tokyo'

      // 1) 撮影日時（ローカル→UTC）
      const utcDate = fromZonedTime(new Date(takenLocal), timezone)
      // 2) EXIF時刻（真値）を読み取り
      const exifDate = await readExifDate(file)
      // 3) meals 行を先に作成（EXIF > フォームの順で採用）
      const takenAtIso = (exifDate ?? utcDate).toISOString()
      const { data: mealIns, error: mealErr } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          meal_slot: mealSlot,
          taken_at: takenAtIso,
        })
        .select('id')
        .single()
      if (mealErr) throw mealErr
      const mealId = mealIns.id as number

      // 4) 解析用JPEG（無縮小） / プレビューJPEG（縮小）
      //    HEICなら heic2any、その他は Canvas 経由で JPEG 化
      let analysisBlob: Blob
      if (looksLikeHeic(file)) {
        const { default: heic2any } = await import('heic2any')
        analysisBlob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob
      } else {
        analysisBlob = await toJpeg(file, 0.9)
    }
      const previewBlob = await toJpegPreview(file, 1024, 0.8)

      // 5) ファイル名は撮影時刻ベース
      const dateForName = exifDate ?? new Date(takenLocal)
      const base = formatStamp(dateForName, timezone) // "YYYYMMDD_HHmmss"
      const analysisName = `${base}.jpg`
      const previewName  = `preview_${base}.jpg`

      const safeAnalysis = analysisName.replace(/[^\w.\-]/g, '_')
      const safePreview  = previewName.replace(/[^\w.\-]/g, '_')

      const analysisPath = `${user.id}/${mealId}/${Date.now()}_${safeAnalysis}`
      const previewPath  = `${user.id}/${mealId}/${Date.now()}_${safePreview}`

      // 6) アップロード
      const up1 = await supabase.storage.from('meal-images').upload(analysisPath, analysisBlob, { cacheControl: '3600', upsert: false })
      if (up1.error) throw up1.error
      const up2 = await supabase.storage.from('meal-images').upload(previewPath,  previewBlob,  { cacheControl: '3600', upsert: false })
      if (up2.error) throw up2.error

      // 7) DB にパスを保存
      const { error: imgErr } = await supabase
        .from('meal_images')
        .insert({ meal_id: mealId, storage_path: analysisPath, preview_path: previewPath })
        .select('id')
        .single()
      if (imgErr) throw imgErr

      setMsg('アップロードと保存が完了しました。解析キューに投入しました。')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="p-6 space-y-3">
        <p>ログインが必要です。</p>
        <Link className="rounded bg-black text-white px-3 py-2 inline-block" href="/sign-in">サインインへ</Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">食事の記録（新規）</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">食事区分</label>
          <select value={mealSlot} onChange={(e) => setMealSlot(e.target.value as MealSlot)} className="w-full rounded border p-2">
            <option value="breakfast">朝食</option>
            <option value="lunch">昼食</option>
            <option value="dinner">夕食</option>
            <option value="snack">軽食</option>
            <option value="drink">飲み物</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">撮影日時（ローカル）</label>
          <input
            type="datetime-local"
            value={takenLocal}
            onChange={(e) => setTakenLocal(e.target.value)}
            className="w-full rounded border p-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            タイムゾーン：{profile?.timezone ?? 'Asia/Tokyo'}（プロフィールで変更可）
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1">画像ファイル</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="w-full"
          />
        </div>

        <button type="submit" disabled={loading} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
          {loading ? '保存中…' : '保存する'}
        </button>

        {msg && <p className="text-green-700 text-sm whitespace-pre-wrap">{msg}</p>}
        {err && <p className="text-red-700 text-sm whitespace-pre-wrap">{err}</p>}
      </form>

      <div className="pt-4">
        <Link href="/meals" className="text-blue-600 underline">記録一覧を見る</Link>
      </div>
    </div>
  )
}