'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [camErr, setCamErr] = useState<string | null>(null)
  const [camBusy, setCamBusy] = useState(false)
  const [camPreviewUrl, setCamPreviewUrl] = useState<string | null>(null)
  const [camStream, setCamStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

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

  const stopCamera = () => {
    camStream?.getTracks().forEach((t) => t.stop())
    setCamStream(null)
    const v = videoRef.current
    if (v) {
      v.srcObject = null
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
      if (camPreviewUrl) URL.revokeObjectURL(camPreviewUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCamera = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCamErr('この端末ではカメラを利用できません。')
      return
    }
    setCamErr(null)
    if (camStream) return
    setCamBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      setCamStream(stream)
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play()
      }
    } catch (e: any) {
      setCamErr(e?.message ?? 'カメラの起動に失敗しました。')
    } finally {
      setCamBusy(false)
    }
  }

  const capturePhoto = async () => {
    setCamErr(null)
    const v = videoRef.current
    if (!v) return setCamErr('カメラが起動していません。')
    const w = v.videoWidth
    const h = v.videoHeight
    if (!w || !h) return setCamErr('カメラの準備中です。')

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return setCamErr('描画に失敗しました。')
    ctx.drawImage(v, 0, 0, w, h)
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9))
    if (!blob) return setCamErr('画像の取得に失敗しました。')

    // BlobをFile化して既存のアップロードフローに渡す
    const capturedFile = new File([blob], 'camera.jpg', { type: 'image/jpeg' })
    setCamPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(blob)
    })
    await onFileChange(capturedFile)
  }

  const clearCamPreview = () => {
    setCamPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setFile(null)
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
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
        <div className="mx-auto max-w-xl px-5 py-8 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">食事を記録する</h1>
          <p className="text-sm text-slate-700">サインインすると撮影とアップロードができます。</p>
          <Link className="block text-center rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 transition" href="/sign-in">サインインへ</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-xl px-5 py-6 space-y-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">capture</p>
          <h1 className="text-2xl font-bold text-slate-900">食事を記録する</h1>
          <p className="text-sm text-slate-700">食事全体が確認できるように撮影してください。カメラ起動ですぐ撮影できます。</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <section className="rounded-2xl border border-amber-200 bg-white/80 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">camera</p>
                <p className="text-sm text-slate-800">カメラを起動して撮影</p>
              </div>
              <span className="text-[11px] text-slate-600 bg-amber-100 px-2 py-1 rounded-full">推奨</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startCamera}
                disabled={camBusy || !!camStream}
                className="flex-1 min-w-[140px] rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 disabled:opacity-60 transition text-center"
              >
                {camBusy ? 'カメラ起動中…' : camStream ? 'カメラ起動中' : 'カメラを起動'}
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!camStream || camBusy}
                className="flex-1 min-w-[140px] rounded-lg bg-slate-900 text-white px-4 py-3 font-semibold hover:bg-slate-800 disabled:opacity-60 transition text-center"
              >
                シャッター
              </button>
              <button
                type="button"
                onClick={stopCamera}
                disabled={!camStream}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-amber-400 transition"
              >
                カメラ停止
              </button>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-black/80">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  playsInline
                  muted
                />
              </div>
              {camPreviewUrl && (
                <div className="space-y-2 relative">
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      type="button"
                      onClick={clearCamPreview}
                      className="rounded bg-white/85 px-2 py-1 text-xs border border-slate-200 shadow-sm"
                    >
                      再撮影
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded bg-slate-900/85 text-white px-2 py-1 text-xs shadow-sm"
                    >
                      撮影終了
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">直近の撮影プレビュー</p>
                  <img src={camPreviewUrl} alt="カメラで撮影した画像" className="w-full rounded-lg border border-slate-200" />
                </div>
              )}
              {camErr && <p className="text-sm text-red-700">{camErr}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">詳細</h2>
              <span className="text-[11px] text-slate-500">必須</span>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-800">
                食事区分
                <select value={mealSlot} onChange={(e) => setMealSlot(e.target.value as MealSlot)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white">
                  <option value="breakfast">朝食</option>
                  <option value="lunch">昼食</option>
                  <option value="dinner">夕食</option>
                  <option value="snack">軽食</option>
                  <option value="drink">飲み物</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-800">
                撮影日時（ローカル）
                <input
                  type="datetime-local"
                  value={takenLocal}
                  onChange={(e) => setTakenLocal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                <p className="text-xs text-slate-500 mt-1">
                  タイムゾーン：{profile?.timezone ?? 'Asia/Tokyo'}（プロフィールで変更可）
                </p>
              </label>

              <label className="block text-sm font-medium text-slate-800">
                アップロードから選ぶ（オプション）
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">カメラで撮影できない場合はこちらから選択。</p>
              </label>
            </div>
          </section>

          <div className="space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold text-center hover:bg-amber-600 disabled:opacity-60 transition"
            >
              {loading ? '保存中…' : '保存する'}
            </button>
            {msg && <p className="text-green-700 text-sm whitespace-pre-wrap">{msg}</p>}
            {err && <p className="text-red-700 text-sm whitespace-pre-wrap">{err}</p>}
          </div>

          <div className="text-center">
            <Link href="/meals" className="text-sm text-slate-600 underline decoration-amber-500 decoration-2 underline-offset-4">記録一覧を見る</Link>
          </div>
        </form>
      </div>
    </main>
  )
}
