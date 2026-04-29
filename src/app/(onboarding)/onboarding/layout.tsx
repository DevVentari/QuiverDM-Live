import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome — QuiverDM',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden dark">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg, hsl(240 15% 7%) 0%, hsl(25 18% 9%) 55%, hsl(240 12% 6%) 100%)' }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.028,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px',
        }}
      />
      {/* Amber glow — top left */}
      <div
        className="absolute pointer-events-none"
        style={{ top: -120, left: -80, width: 500, height: 500, background: 'radial-gradient(circle, hsl(35 80% 55% / 0.07) 0%, transparent 65%)' }}
      />
      {/* Purple glow — bottom right */}
      <div
        className="absolute pointer-events-none"
        style={{ bottom: -100, right: -100, width: 400, height: 400, background: 'radial-gradient(circle, hsl(258 50% 40% / 0.06) 0%, transparent 65%)' }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 30%, hsl(240 12% 4% / 0.55) 100%)' }}
      />

      {/* Logo */}
      <div className="absolute top-6 left-8 flex items-center gap-3 z-10">
        <img src="/images/logo.svg" alt="QuiverDM" width={32} height={32} />
        <span
          className="font-display text-sm font-bold tracking-[0.16em]"
          style={{ color: 'hsl(35 70% 88%)' }}
        >
          QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
        </span>
      </div>

      <div className="relative z-10 w-full px-4 py-16">
        {children}
      </div>
    </div>
  );
}
