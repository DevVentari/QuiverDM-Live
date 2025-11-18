import Link from 'next/link';
import { Button, Badge, Card, Flex, Text, Heading, Grid, Box, Avatar } from '@radix-ui/themes';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  // Redirect authenticated users to their dashboard
  const session = await auth();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-3xl">🎲</div>
            <h1 className="text-2xl font-bold text-white">QuiverDM</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth/signin">
              <Button size="3" variant="ghost" style={{ color: 'white' }}>
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="3" style={{ backgroundColor: '#8B5CF6', color: 'white' }}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Your Campaign
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Command Center
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed">
            Manage sessions, track NPCs, organize homebrew content, and never miss a detail.
            <br />
            Built for Dungeon Masters who want to focus on storytelling.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="4" style={{ backgroundColor: '#8B5CF6', color: 'white', fontSize: '1.125rem', padding: '0 2rem' }}>
                Start Free
              </Button>
            </Link>
            <Button size="4" variant="outline" style={{ color: 'white', borderColor: 'white', fontSize: '1.125rem', padding: '0 2rem' }}>
              View Demo
            </Button>
          </div>
          <p className="text-gray-400 mt-6">Free for small groups • No credit card required</p>
        </div>
      </section>

      {/* Features Grid - D&D Beyond Style */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Everything You Need at Your Table
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 - Session Recording */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all group">
            <div className="text-5xl mb-4">🎙️</div>
            <h3 className="text-2xl font-bold text-white mb-3">Session Recording</h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              Record your sessions and get automatic transcriptions with speaker detection. Search through past sessions instantly.
            </p>
            <div className="text-sm text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Powered by speech recognition
            </div>
          </div>

          {/* Feature 2 - Homebrew Library */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all group">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-2xl font-bold text-white mb-3">Homebrew Library</h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              Upload PDFs and organize custom items, creatures, spells, and locations in one searchable library.
            </p>
            <div className="text-sm text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Smart content extraction
            </div>
          </div>

          {/* Feature 3 - NPC Management */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-2xl font-bold text-white mb-3">NPC & Player Tracking</h3>
            <p className="text-gray-300 leading-relaxed">
              Detailed stat blocks, relationships, and notes. Keep your world organized and your NPCs memorable.
            </p>
          </div>

          {/* Feature 4 - Campaign Timeline */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all group">
            <div className="text-5xl mb-4">📖</div>
            <h3 className="text-2xl font-bold text-white mb-3">Campaign Timeline</h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              Session summaries and searchable transcripts. Review past sessions and track your story arc.
            </p>
            <div className="text-sm text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Auto-generated summaries
            </div>
          </div>

          {/* Feature 5 - Mobile Ready */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">📱</div>
            <h3 className="text-2xl font-bold text-white mb-3">Mobile-First & Offline</h3>
            <p className="text-gray-300 leading-relaxed">
              Access your campaign anywhere, anytime. Works offline as a Progressive Web App.
            </p>
          </div>

          {/* Feature 6 - Fast Search */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-2xl font-bold text-white mb-3">Lightning Fast Search</h3>
            <p className="text-gray-300 leading-relaxed">
              Find any item, NPC, session note, or homebrew content in milliseconds. Never lose track of details again.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Simple Campaign Management
        </h2>
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              1
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Create Your Campaign</h3>
              <p className="text-gray-300">
                Set up your campaign in seconds. Add players, NPCs, and campaign details. Import from D&D Beyond if you want.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              2
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Build Your Library</h3>
              <p className="text-gray-300">
                Upload PDF sourcebooks and organize custom content. Create items, creatures, spells, and locations in a searchable library.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              3
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Run Your Sessions</h3>
              <p className="text-gray-300">
                Record sessions for transcription and summaries. Track NPCs, update campaign notes, and keep everything organized.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              4
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Focus on the Story</h3>
              <p className="text-gray-300">
                Let QuiverDM handle organization and notes. You focus on creating memorable adventures for your players.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Built by DMs, for DMs
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <div className="flex mb-4">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-xl">★</span>
              ))}
            </div>
            <p className="text-gray-300 mb-4 italic">
              &quot;The session transcription feature saves me hours. I can actually focus on DMing instead of frantically taking notes.&quot;
            </p>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                M
              </div>
              <div>
                <div className="text-white font-bold">Marcus Chen</div>
                <div className="text-gray-400 text-sm">DM for 8 years</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <div className="flex mb-4">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-xl">★</span>
              ))}
            </div>
            <p className="text-gray-300 mb-4 italic">
              &quot;Finally, all my homebrew PDFs in one searchable place. No more flipping through books during sessions.&quot;
            </p>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                S
              </div>
              <div>
                <div className="text-white font-bold">Sarah Williams</div>
                <div className="text-gray-400 text-sm">DM for 5 years</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <div className="flex mb-4">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-xl">★</span>
              ))}
            </div>
            <p className="text-gray-300 mb-4 italic">
              &quot;This is exactly what I needed - a tool that understands campaign management without getting in the way.&quot;
            </p>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                J
              </div>
              <div>
                <div className="text-white font-bold">Jake Morrison</div>
                <div className="text-gray-400 text-sm">DM for 12 years</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Level Up Your Campaign?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join DMs using QuiverDM to run more organized, engaging campaigns.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="4" style={{ backgroundColor: 'white', color: '#8B5CF6', fontSize: '1.125rem', padding: '0 2rem' }}>
                Start Free
              </Button>
            </Link>
            <Button size="4" variant="outline" style={{ color: 'white', borderColor: 'white', fontSize: '1.125rem', padding: '0 2rem' }}>
              View Features
            </Button>
          </div>
          <p className="text-white/80 mt-6">Free for small groups • No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="text-2xl">🎲</div>
            <span className="text-xl font-bold text-white">QuiverDM</span>
          </div>
          <div className="flex space-x-6 mb-4 md:mb-0">
            <Link href="#" className="text-gray-400 hover:text-white transition">
              About
            </Link>
            <Link href="#" className="text-gray-400 hover:text-white transition">
              Features
            </Link>
            <Link href="#" className="text-gray-400 hover:text-white transition">
              Docs
            </Link>
            <Link href="#" className="text-gray-400 hover:text-white transition">
              Contact
            </Link>
          </div>
          <div className="text-gray-400">
            © 2025 QuiverDM. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
