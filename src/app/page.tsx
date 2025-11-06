export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-6xl font-bold text-center mb-8 bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
          QuiverDM
        </h1>
        <p className="text-center text-xl text-muted-foreground mb-12">
          AI-Powered D&D Session Management for Dungeon Masters
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="p-6 bg-card rounded-lg border border-border hover:border-primary transition-colors">
            <h3 className="text-xl font-semibold mb-2">📼 Session Recording</h3>
            <p className="text-muted-foreground">
              Upload audio/video recordings and get AI-generated transcripts with campaign-specific corrections.
            </p>
          </div>

          <div className="p-6 bg-card rounded-lg border border-border hover:border-primary transition-colors">
            <h3 className="text-xl font-semibold mb-2">📚 Homebrew Library</h3>
            <p className="text-muted-foreground">
              Import PDFs of homebrew content and organize items, creatures, and spells with AI categorization.
            </p>
          </div>

          <div className="p-6 bg-card rounded-lg border border-border hover:border-primary transition-colors">
            <h3 className="text-xl font-semibold mb-2">🎭 Campaign Management</h3>
            <p className="text-muted-foreground">
              Track NPCs, sessions, and player notes in one centralized, offline-capable tool.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Coming Soon • Built with Next.js, Prisma, and AI
          </p>
        </div>
      </div>
    </main>
  );
}
