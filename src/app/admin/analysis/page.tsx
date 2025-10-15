import DashboardClient from './DashboardClient';

export default function AdminAnalysisPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">管理ダッシュボード</h1>
      <DashboardClient />
    </main>
  );
}