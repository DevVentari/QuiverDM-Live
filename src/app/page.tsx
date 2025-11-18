import Link from 'next/link';
import { Button } from '@radix-ui/themes';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MarketingPage() {
  // Redirect authenticated users to campaigns
  const session = await auth();
  if (session) {
    redirect('/campaigns');
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
              <Button size="3" style={{ backgroundColor: '#9333ea', color: 'white' }}>
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
            Your AI-Powered
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              D&D Session Manager
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed">
            Record your sessions, transcribe with AI, manage homebrew content, and keep your campaign organized—all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="4" style={{ backgroundColor: '#9333ea', color: 'white', fontSize: '1.125rem', padding: '0 2rem' }}>
                Start Free Trial
              </Button>
            </Link>
            <Button size="4" variant="outline" style={{ color: 'white', borderColor: 'white', fontSize: '1.125rem', padding: '0 2rem' }}>
              Watch Demo
            </Button>
          </div>
          <p className="text-gray-400 mt-6">No credit card required • Free forever for small groups</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Everything You Need to Run Epic Campaigns
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">🎙️</div>
            <h3 className="text-2xl font-bold text-white mb-3">AI Session Recording</h3>
            <p className="text-gray-300 leading-relaxed">
              Record your sessions and get automatic transcriptions with speaker diarization. Never miss a moment of your epic adventures.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-2xl font-bold text-white mb-3">Homebrew Library</h3>
            <p className="text-gray-300 leading-relaxed">
              Upload PDFs and extract homebrew content with AI. Organize custom items, creatures, spells, and locations in one searchable library.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-2xl font-bold text-white mb-3">Lightning Fast Processing</h3>
            <p className="text-gray-300 leading-relaxed">
              Powered by Marker + Gemini AI. Process 400-page sourcebooks in ~2 minutes for just $0.15. 10x faster than traditional methods.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-2xl font-bold text-white mb-3">NPC & Player Management</h3>
            <p className="text-gray-300 leading-relaxed">
              Track NPCs, player characters, relationships, and campaign notes. Keep your world organized and accessible.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">🗺️</div>
            <h3 className="text-2xl font-bold text-white mb-3">Campaign Timeline</h3>
            <p className="text-gray-300 leading-relaxed">
              Automatic session summaries, searchable transcripts, and timeline of key events. Review past sessions with ease.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
            <div className="text-5xl mb-4">📱</div>
            <h3 className="text-2xl font-bold text-white mb-3">Mobile-First & Offline</h3>
            <p className="text-gray-300 leading-relaxed">
              Progressive Web App (PWA) works offline. Access your campaign anywhere, anytime, even without internet.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          How It Works
        </h2>
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              1
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Create Your Campaign</h3>
              <p className="text-gray-300">
                Set up your campaign in seconds. Add players, NPCs, and campaign details.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              2
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Upload Homebrew Content</h3>
              <p className="text-gray-300">
                Upload PDF sourcebooks and let our AI extract items, creatures, spells, and more. Organize your custom content in a searchable library.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              3
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Record Your Sessions</h3>
              <p className="text-gray-300">
                Hit record during your game. Our AI transcribes with speaker detection and generates summaries automatically.
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
                Let QuiverDM handle the notes, transcripts, and organization. You focus on creating memorable adventures.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Simple, Transparent Pricing
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Tier */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-2">Starter</h3>
            <div className="text-4xl font-bold text-white mb-6">Free</div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                1 campaign
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                Up to 5 players
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                10 hours transcription/month
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                Basic homebrew library
              </li>
            </ul>
            <Button size="3" variant="outline" style={{ width: '100%', color: 'white', borderColor: 'white' }}>
              Get Started
            </Button>
          </div>

          {/* Pro Tier */}
          <div className="bg-gradient-to-b from-purple-600 to-purple-800 rounded-2xl p-8 border-2 border-purple-400 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
            <div className="text-4xl font-bold text-white mb-1">
              $9<span className="text-xl">/month</span>
            </div>
            <p className="text-purple-200 mb-6">or $90/year (save $18)</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-white">
                <span className="text-green-400 mr-2">✓</span>
                Unlimited campaigns
              </li>
              <li className="flex items-center text-white">
                <span className="text-green-400 mr-2">✓</span>
                Unlimited players
              </li>
              <li className="flex items-center text-white">
                <span className="text-green-400 mr-2">✓</span>
                50 hours transcription/month
              </li>
              <li className="flex items-center text-white">
                <span className="text-green-400 mr-2">✓</span>
                Advanced AI features
              </li>
              <li className="flex items-center text-white">
                <span className="text-green-400 mr-2">✓</span>
                D&D Beyond integration
              </li>
              <li className="flex items-center text-white">
                <span className="text-green-400 mr-2">✓</span>
                Priority support
              </li>
            </ul>
            <Button size="3" style={{ width: '100%', backgroundColor: 'white', color: '#9333ea' }}>
              Start Free Trial
            </Button>
          </div>

          {/* Team Tier */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-2">Team</h3>
            <div className="text-4xl font-bold text-white mb-6">Custom</div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                Everything in Pro
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                Multiple DMs
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                Shared campaign library
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                Custom integrations
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span>
                Dedicated support
              </li>
            </ul>
            <Button size="3" variant="outline" style={{ width: '100%', color: 'white', borderColor: 'white' }}>
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Loved by Dungeon Masters
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
            <div className="flex mb-4">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-xl">★</span>
              ))}
            </div>
            <p className="text-gray-300 mb-4 italic">
              &quot;QuiverDM has completely transformed how I run my campaigns. The AI transcription saves me hours of note-taking!&quot;
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
              &quot;The homebrew library is amazing! I uploaded all my PDFs and can search through everything instantly.&quot;
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
              &quot;Finally, a tool that understands what DMs actually need. The session summaries are spot-on.&quot;
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
            Join thousands of DMs using QuiverDM to run better games.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="4" style={{ backgroundColor: 'white', color: '#9333ea', fontSize: '1.125rem', padding: '0 2rem' }}>
                Start Free Trial
              </Button>
            </Link>
            <Button size="4" variant="outline" style={{ color: 'white', borderColor: 'white', fontSize: '1.125rem', padding: '0 2rem' }}>
              Schedule Demo
            </Button>
          </div>
          <p className="text-white/80 mt-6">14-day free trial • No credit card required</p>
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
              Pricing
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
