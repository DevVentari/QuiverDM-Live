import Link from 'next/link';
import { Button } from '@radix-ui/themes';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  // Redirect authenticated users to their dashboard
  const session = await auth();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-cream-bg">
      {/* Navigation */}
      <nav className="border-b border-cream-border bg-cream-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🏹</span>
              <h1 className="text-2xl font-display text-text-primary">QuiverDM</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/signin">
                <Button size="3" variant="ghost" className="text-text-secondary hover:text-text-primary">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="3" className="bg-accent-warm hover:bg-accent-light text-cream-bg font-semibold">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-cream-white/50 to-transparent pointer-events-none" />
        <div className="absolute top-20 left-10 w-64 h-64 bg-accent-warm/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-warm/5 rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto px-6 py-24 relative">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-display text-text-primary mb-6 leading-tight tracking-wide">
              Your Campaign
              <br />
              <span className="text-accent-warm">Command Center</span>
            </h1>
            <p className="text-xl md:text-2xl text-text-secondary font-body mb-10 leading-relaxed max-w-2xl mx-auto">
              Manage sessions, track NPCs, organize homebrew content, and never miss a detail.
              Built for Dungeon Masters who want to focus on storytelling.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button size="4" className="bg-accent-warm hover:bg-accent-light text-cream-bg font-display text-lg px-8 py-3 transition-all hover:scale-105">
                  Start Your Journey
                </Button>
              </Link>
              <Button size="4" variant="outline" className="border-cream-border text-text-primary hover:bg-cream-light font-display text-lg px-8 py-3">
                View Demo
              </Button>
            </div>
            <p className="text-text-secondary/70 mt-6 font-body">Free for small groups • No credit card required</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-cream-white/30">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-display text-text-primary text-center mb-16">
            Everything You Need at Your Table
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 - Session Recording */}
            <FeatureCard
              emoji="🎙️"
              title="Session Recording"
              description="Record your sessions and get automatic transcriptions with speaker detection. Search through past sessions instantly."
              badge="Powered by AI"
            />

            {/* Feature 2 - Homebrew Library */}
            <FeatureCard
              emoji="📚"
              title="Homebrew Library"
              description="Upload PDFs and organize custom items, creatures, spells, and locations in one searchable library."
              badge="Smart extraction"
            />

            {/* Feature 3 - NPC Management */}
            <FeatureCard
              emoji="👥"
              title="NPC & Player Tracking"
              description="Detailed stat blocks, relationships, and notes. Keep your world organized and your NPCs memorable."
            />

            {/* Feature 4 - Campaign Timeline */}
            <FeatureCard
              emoji="📖"
              title="Campaign Timeline"
              description="Session summaries and searchable transcripts. Review past sessions and track your story arc."
              badge="Auto-summaries"
            />

            {/* Feature 5 - Mobile Ready */}
            <FeatureCard
              emoji="📱"
              title="Mobile-First & Offline"
              description="Access your campaign anywhere, anytime. Works offline as a Progressive Web App."
            />

            {/* Feature 6 - Fast Search */}
            <FeatureCard
              emoji="⚡"
              title="Lightning Fast Search"
              description="Find any item, NPC, session note, or homebrew content in milliseconds. Never lose track of details again."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-display text-text-primary text-center mb-16">
            Simple Campaign Management
          </h2>
          <div className="space-y-8">
            <Step number={1} title="Create Your Campaign" description="Set up your campaign in seconds. Add players, NPCs, and campaign details. Import from D&D Beyond if you want." />
            <Step number={2} title="Build Your Library" description="Upload PDF sourcebooks and organize custom content. Create items, creatures, spells, and locations in a searchable library." />
            <Step number={3} title="Run Your Sessions" description="Record sessions for transcription and summaries. Track NPCs, update campaign notes, and keep everything organized." />
            <Step number={4} title="Focus on the Story" description="Let QuiverDM handle organization and notes. You focus on creating memorable adventures for your players." />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-cream-white/30">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-display text-text-primary text-center mb-16">
            Built by DMs, for DMs
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Testimonial
              quote="The session transcription feature saves me hours. I can actually focus on DMing instead of frantically taking notes."
              name="Marcus Chen"
              role="DM for 8 years"
            />
            <Testimonial
              quote="Finally, all my homebrew PDFs in one searchable place. No more flipping through books during sessions."
              name="Sarah Williams"
              role="DM for 5 years"
            />
            <Testimonial
              quote="This is exactly what I needed - a tool that understands campaign management without getting in the way."
              name="Jake Morrison"
              role="DM for 12 years"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-br from-cream-light to-cream-white border border-cream-border rounded-2xl p-12 text-center relative overflow-hidden">
            {/* Decorative corner ornaments */}
            <div className="absolute top-4 left-4 text-accent-warm/30 text-4xl">❧</div>
            <div className="absolute bottom-4 right-4 text-accent-warm/30 text-4xl rotate-180">❧</div>

            <h2 className="text-4xl md:text-5xl font-display text-text-primary mb-6">
              Ready to Level Up Your Campaign?
            </h2>
            <p className="text-xl text-text-secondary font-body mb-8">
              Join DMs using QuiverDM to run more organized, engaging campaigns.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button size="4" className="bg-accent-warm hover:bg-accent-light text-cream-bg font-display text-lg px-8 transition-all hover:scale-105">
                  Start Free
                </Button>
              </Link>
              <Button size="4" variant="outline" className="border-cream-border text-text-primary hover:bg-cream-light font-display text-lg px-8">
                View Features
              </Button>
            </div>
            <p className="text-text-secondary/70 mt-6 font-body">Free for small groups • No credit card required</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cream-border py-12 bg-cream-white/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <span className="text-2xl">🏹</span>
              <span className="text-xl font-display text-text-primary">QuiverDM</span>
            </div>
            <div className="flex space-x-6 mb-4 md:mb-0">
              <Link href="#" className="text-text-secondary hover:text-accent-warm transition font-body">
                About
              </Link>
              <Link href="#" className="text-text-secondary hover:text-accent-warm transition font-body">
                Features
              </Link>
              <Link href="#" className="text-text-secondary hover:text-accent-warm transition font-body">
                Docs
              </Link>
              <Link href="#" className="text-text-secondary hover:text-accent-warm transition font-body">
                Contact
              </Link>
            </div>
            <div className="text-text-secondary/70 font-body">
              © 2025 QuiverDM. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ emoji, title, description, badge }: { emoji: string; title: string; description: string; badge?: string }) {
  return (
    <div className="bg-cream-white border border-cream-border rounded-xl p-8 hover:border-accent-warm/50 transition-all group hover:shadow-lg hover:shadow-accent-warm/5">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="text-xl font-display text-text-primary mb-3 group-hover:text-accent-warm transition-colors">{title}</h3>
      <p className="text-text-secondary font-body leading-relaxed mb-4">
        {description}
      </p>
      {badge && (
        <span className="text-sm text-accent-warm font-body opacity-0 group-hover:opacity-100 transition-opacity">
          {badge}
        </span>
      )}
    </div>
  );
}

// Step Component
function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
      <div className="flex-shrink-0 w-14 h-14 bg-accent-warm rounded-full flex items-center justify-center text-2xl font-display text-cream-bg shadow-lg shadow-accent-warm/20">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-display text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary font-body">
          {description}
        </p>
      </div>
    </div>
  );
}

// Testimonial Component
function Testimonial({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <div className="bg-cream-white border border-cream-border rounded-xl p-8">
      <div className="flex mb-4 text-accent-warm">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="text-xl">★</span>
        ))}
      </div>
      <p className="text-text-secondary font-body mb-6 italic leading-relaxed">
        &quot;{quote}&quot;
      </p>
      <div className="flex items-center">
        <div className="w-10 h-10 bg-accent-warm/20 rounded-full flex items-center justify-center text-accent-warm font-display font-bold mr-3">
          {name[0]}
        </div>
        <div>
          <div className="text-text-primary font-display">{name}</div>
          <div className="text-text-secondary/70 text-sm font-body">{role}</div>
        </div>
      </div>
    </div>
  );
}
