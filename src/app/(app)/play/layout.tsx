import { PlayNav } from '@/components/play/play-nav';

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-56 flex-col border-r border-white/5 bg-background/50 shrink-0">
        <PlayNav />
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
