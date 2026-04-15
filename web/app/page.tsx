import DashboardView from "@/components/DashboardView";

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-page)', color: 'var(--text-body)' }}>
      <DashboardView />
    </main>
  );
}
