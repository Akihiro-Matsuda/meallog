// Deno/Edge Function: analyze-meal (Colab準拠版)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// === Secrets / 環境変数 ===
// SUPABASE_URL は実行環境に自動注入。SERVICE_ROLE_KEY / OPENAI_* は secrets で設定済み前提
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE   = Deno.env.get("SERVICE_ROLE_KEY")!
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!
const OPENAI_MODEL   = Deno.env.get("OPENAI_MODEL") || "o3"
const DETAIL         = Deno.env.get("OPENAI_IMAGE_DETAIL") || "high" // Colabの DETAIL=high に相当

// ===================== 許可カテゴリ（大分類＋other） =====================
const ALLOWED_CATS = [
  "rice","bread","noodles","pasta","grains_cereals","starchy_veg","poultry","pork","beef","fish_seafood","soy_legumes","eggs",
  "nonstarchy_veg","fruit","dairy","nuts_seeds","soup_broth","dessert_sweets","mixed_dish","other"
]
const ALLOWED_SET = new Set(ALLOWED_CATS)

// ===================== プロンプト（Colab版そのまま） =====================
const SYSTEM_PROMPT = `
あなたは管理栄養士かつ画像解析の専門家です。食事画像から **次の8項目のみ** を返してください。
**派生量（GL、各種フラグ、balance、duration など）は一切含めない** でください。

[出力フィールド（厳守）]
1) carbs_g: number (g) 0以上。小数1桁で丸める
2) fat_g: number (g) 0以上。小数1桁
3) protein_g: number (g) 0以上。小数1桁
4) fiber_g: number (g) 0以上。小数1桁
5) GI: integer 20..110。主要炭水化物の代表GI（複数ある場合は寄与最大の1種）
6) alcohol_ml: integer (mL)。明確なアルコールが写っている時のみ >0（曖昧なら 0）
7) major_food_categories: string[]（3〜5個）。**Allowed tokens からのみ選ぶ**
8) image_blur_flag: 0 or 1。ぼけ/暗部/遮蔽/低解像度/強ノイズで判別困難なら 1

[並び順の規則]
- major_food_categories は **炭水化物量×代表GI の推定寄与が大きい順**（降順）に並べる。
- 厳密な量が不明な場合は、視覚的な面積×一般的密度や典型量で近似。
- 迷う場合は、主食(炭水化物) > 主菜(たんぱく/脂質) > 副菜(非でんぷん野菜/海藻/きのこ/漬物) > スープ/その他 の優先度でタイブレーク。
# もし順序に意味を持たせない運用に切り替える場合は、上の3行を無視し「重複なしで任意順」にすること。

[フォーマット厳守]
- 出力は **上記8キーのみ** の JSON オブジェクト。追加テキストは禁止。
- キー順序: carbs_g,fat_g,protein_g,fiber_g,GI,alcohol_ml,major_food_categories,image_blur_flag

[Allowed tokens]: ${ALLOWED_CATS.join(", ")}
`.trim()

// ===================== JSON Schema（Structured Outputs：Colab版そのまま） =====================
const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "meal_nutrition",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        carbs_g:   { type: "number",  minimum: 0 },
        fat_g:     { type: "number",  minimum: 0 },
        protein_g: { type: "number",  minimum: 0 },
        fiber_g:   { type: "number",  minimum: 0 },
        GI:        { type: "integer", minimum: 20, maximum: 110 },
        alcohol_ml:{ type: "integer", minimum: 0,  maximum: 1000 },
        major_food_categories: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string", enum: ALLOWED_CATS }
        },
        image_blur_flag: { type: "integer", enum: [0, 1] }
      },
      required: ["carbs_g","fat_g","protein_g","fiber_g","GI","alcohol_ml","major_food_categories","image_blur_flag"]
    }
  }
}
// === Signed URL を実体取得して Data URI にする ===
// async function dataUriFromSignedUrl(signedUrl: string, storagePath: string): Promise<string> {
//   const r = await fetch(signedUrl);
//   if (!r.ok) throw new Error(`download failed: ${r.status}`);
//   const buf = await r.arrayBuffer();
//   // 拡張子から MIME を決定（jpg/png/webp くらい見れば十分）
//   const lower = storagePath.toLowerCase();
//   const mime =
//     lower.endsWith(".png")  ? "image/png"  :
//     lower.endsWith(".webp") ? "image/webp" :
//                                "image/jpeg";
//   base64 化
//   const b64 = base64Encode(new Uint8Array(buf));
//   return `data:${mime};base64,${b64}`;
// }

// ====== Utils（Colabの fnum/inum & 時刻抽出をTSへ移植） ======
const fnum = (x: unknown) => {
  const v = Number(x)
  if (Number.isNaN(v)) return 0.0
  return Math.round(Math.max(0, v) * 10) / 10
}
const inum = (x: unknown) => {
  const v = Number(x)
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.round(v))
}
function jstIsoFromParts(yyyy: string, mm: string, dd: string, HH: string, MM: string, SS: string) {
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}+09:00` // 文字列生成（JST前提）
}
function nowJstIso(): string {
  const d = new Date();
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...o }).format(d);
  return `${fmt({year:"numeric"})}-${fmt({month:"2-digit"})}-${fmt({day:"2-digit"})}`
       + `T${fmt({hour:"2-digit",hour12:false})}:${fmt({minute:"2-digit"})}:${fmt({second:"2-digit"})}+09:00`;
}

// YYYYMMDD[_-]HHMMSS を「数値の前後が非数字」の位置だけから抽出し、最後の一致を採用
function extractStartTimeFromPathStrict(p: string): string {
  // 例: ".../1758123117948_20240922_083549.jpg" → 2024-09-22T08:35:49+09:00
  const re = /(?<!\d)(\d{8})[_-]?(\d{6})(?!\d)/g;   // <= 前後が数字でない境界を要求
  const matches = Array.from(p.matchAll(re));
  if (matches.length) {
    const m = matches[matches.length - 1];
    const d8 = m[1];              // "YYYYMMDD"
    const t6 = m[2];              // "HHMMSS"
    const y  = d8.slice(0,4), mo = d8.slice(4,6), d = d8.slice(6,8);
    const hh = t6.slice(0,2), mi = t6.slice(2,4), ss = t6.slice(4,6);
    return `${y}-${mo}-${d}T${hh}:${mi}:${ss}+09:00`;
  }
  return nowJstIso();             // ← 予備（JST現在）
}

function toJstIso(ts: string): string {
  const d = new Date(ts);
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', ...o }).format(d);
  return `${f({year:'numeric'})}-${f({month:'2-digit'})}-${f({day:'2-digit'})}`
       + `T${f({hour:'2-digit',hour12:false})}:${f({minute:'2-digit'})}:${f({second:'2-digit'})}+09:00`;
}

// ====== OpenAI 呼び出し（Colabの chat.completions + response_format を忠実に） ======
async function callOpenAI(imageUrl: string) {
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    response_format: RESPONSE_SCHEMA,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "上記の JSON だけ返してください。" },
          { type: "image_url", image_url: { url: imageUrl, detail: DETAIL } }
        ]
      }
    ]
    // temperature / max_tokens は指定なし（Colab準拠 & 互換）
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()

  // 1) 可能なら parsed を優先（新仕様互換）
  const choice = data?.choices?.[0]?.message ?? {}
  if (choice.parsed) return choice.parsed

  // 2) content をパース（```json ... ``` の剥がし + 波括弧抽出の保険）
  let text = String(choice.content ?? "")
  text = text.replace(/^```json\s*|\s*```$/g, "").trim()
  if (!text.includes("{")) {
    // 波括弧が見つからない場合、空のオブジェクトを返して上流でデフォルト値に落とす
    return {}
  }
  try {
    // 最初と最後の {} を拾ってパース（混入テキストに強い）
    const s = text.indexOf("{")
    const e = text.lastIndexOf("}")
    return JSON.parse(text.slice(s, e + 1))
  } catch {
    return {}
  }
}

// ====== メイン（jobs → 解析 → meal_analysis.raw_response に Colabと同じレコードを保存） ======
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: any = {};
  try { if (req.method === "POST") body = await req.json(); } catch{}

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE)
  // 1) 対象ジョブを取得
  // ミリ秒を落とした ISO。or フィルタに安全に入れられる
  const nowIsoNoMs = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const { data: jobs, error: jobErr } = await sb
    .from("jobs")
    .select("id, payload")
    .eq("job_type", "analyze_meal")
    .eq("status", "queued")
    // run_at が NULL か、もしくは now 以下のもの
    .or(`run_at.is.null,run_at.lte.${nowIsoNoMs}`)
    .order("id", { ascending: true })   // 既に並びが必要なら
    .limit(5);

  if (jobErr) return new Response(jobErr.message, { status: 500 })
  if (!jobs?.length) return new Response("no-jobs", { status: 200 })

  for (const j of jobs) {
    try {
      await sb.from("jobs").update({ status: "processing" }).eq("id", j.id)

      // 1) payloadの解決（後方互換：image_idが無ければ meal_id から最新画像を拾う）
      let imageId = Number(j.payload?.image_id || 0)
      let mealId  = Number(j.payload?.meal_id  || 0)
      let storagePath = String(j.payload?.storage_path || "")

      if (!imageId) {
        if (!mealId) throw new Error("invalid payload: need image_id or meal_id")
        const { data: latestImg, error: imgErr } = await sb
          .from("meal_images").select("id, storage_path").eq("meal_id", mealId)
          .order("id", { ascending: false }).limit(1).maybeSingle()
        if (imgErr || !latestImg) throw new Error("no image for meal")
        imageId = latestImg.id
        storagePath = latestImg.storage_path
      }

      if (!mealId) {
        // meal_id がpayloadに無い場合は imageから逆引き
        const { data: imgRow } = await sb.from("meal_images").select("meal_id").eq("id", imageId).maybeSingle()
        mealId = Number(imgRow?.meal_id || 0)
      }

      // 2) 画像の署名URL
      const signed = await sb.storage.from("meal-images").createSignedUrl(storagePath, 600)
      if (signed.error || !signed.data?.signedUrl) throw (signed.error ?? new Error("failed to sign url"))
      const imageUrl = signed.data.signedUrl
      // 3) OpenAI（Colab仕様＋response_format）
      const payload = await callOpenAI(imageUrl)

      // meals.taken_at があれば最優先、なければファイル名、最後に現在JST
      const { data: mealRow, error: mealGetErr } = await sb
        .from('meals')
        .select('taken_at')
        .eq('id', mealId)
        .maybeSingle();

      // 4) 正規化＆順序固定（recordOrdered）※あなたの現行コードそのまま
      // payload は callOpenAI の戻り（空 {} の可能性あり）
      const start_time = extractStartTimeFromPathStrict(storagePath)

      // カテゴリ正規化（空でも [] → "",..., "" で5枠埋め）
      let rawCats: unknown = payload?.major_food_categories ?? []
      if (typeof rawCats === "string") {
        rawCats = String(rawCats).split(",").map(s => s.trim()).filter(Boolean)
      }
      const norm: string[] = []
      const seen = new Set<string>()
      for (const c of (Array.isArray(rawCats) ? rawCats : []) as unknown[]) {
        let s = String(c).toLowerCase().replace(/ /g, "_").replace(/[^a-z0-9_]/g, "")
        s = ALLOWED_SET.has(s) ? s : "other"
        if (s && !seen.has(s)) { seen.add(s); norm.push(s) }
      }
      const category_count = norm.length
      const category_overflow_flag = category_count > 5 ? 1 : 0
      const cats5 = (norm.slice(0, 5).concat(["", "", "", "", ""])).slice(0, 5)

      // ★ここが重要：payload が空でも“必ず”CSV同等の1行を作る
      const recordOrdered = {
        meal_id: String(mealId),
        start_time,
        carbs_g:        fnum(payload?.carbs_g),
        fat_g:          fnum(payload?.fat_g),
        protein_g:      fnum(payload?.protein_g),
        fiber_g:        fnum(payload?.fiber_g),
        GI:             Math.min(110, Math.max(20, inum(payload?.GI))),
        alcohol_ml:     inum(payload?.alcohol_ml),
        image_blur_flag: inum(payload?.image_blur_flag) ? 1 : 0,
        category_count,
        category_overflow_flag,
        cat1: cats5[0], cat2: cats5[1], cat3: cats5[2], cat4: cats5[3], cat5: cats5[4],
      }

      // 保存は必ず recordOrdered を使う（payload を直接入れない）
      // ✅ 成功時は done
    await sb.from("meal_image_analysis").upsert({
      image_id: imageId,
      meal_id: mealId,
      status: "done",
      model: OPENAI_MODEL,
      raw_response: recordOrdered,  // ← Colab順の JSON（ゼロ埋めでも必ず入れる）
      prompt_version: "colab-v1",
      ran_at: new Date().toISOString(),
      error: null
    })
    // ✅ 成功時は done
    await sb.from("jobs").update({ status: "done" }).eq("id", j.id)

  } catch (e) {
    // ❗失敗はこちら
    await sb.from("meal_image_analysis").upsert({
      image_id: Number(j.payload?.image_id || 0) || null,
      meal_id: Number(j.payload?.meal_id || 0) || null,
      status: "error",
      model: OPENAI_MODEL,
      raw_response: {}, // 最低限の空でも可（必要ならCSV互換のゼロ埋めに）
      prompt_version: "colab-v1",
      ran_at: new Date().toISOString(),
      error: String(e)
    })
    await sb.from("jobs").update({
      status: "error",
      payload: { ...j.payload, error: String(e) }
    }).eq("id", j.id)
  }
}

  return new Response("ok")
})
