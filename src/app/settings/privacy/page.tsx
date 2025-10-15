// src/app/settings/privacy/page.tsx
"use client";
export default function PrivacyPage() {
  const request = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { credentials: 'same-origin', ...init })
    if (!res.ok) throw new Error(await res.text())
    return res
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">プライバシー</h1>

      <button
        onClick={async ()=>{
          try {
            const res = await request('/api/me/export')
            const blob = await res.blob()
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "meallog-export.ndjson";
          a.click();
            URL.revokeObjectURL(a.href)
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            alert(message)
          }
        }}
        className="px-3 py-2 border rounded"
      >
        データをエクスポート
      </button>

      <button
        onClick={async ()=>{
          if (!confirm("退会します。よろしいですか？")) return;
          try {
            await request('/api/me/delete', { method: 'POST' })
          alert("退会処理しました。");
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            alert(message)
          }
        }}
        className="px-3 py-2 border rounded"
      >
        退会（ソフト削除）
      </button>
    </div>
  );
}
