interface PortalSceneProps {
  children: React.ReactNode;
}

export function PortalScene({ children }: PortalSceneProps) {
  return (
    <div className="min-h-screen w-full flex dark">
      {/* LEFT HERO — atmospheric, logo + tagline */}
      <div className="hidden lg:flex w-[55%] relative flex-col items-center justify-center overflow-hidden">
        {/* Background gradient */}
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
          style={{ top: -100, left: -60, width: 420, height: 420, background: 'radial-gradient(circle, hsl(35 80% 55% / 0.075) 0%, transparent 65%)' }}
        />
        {/* Purple glow — bottom right */}
        <div
          className="absolute pointer-events-none"
          style={{ bottom: -80, right: -80, width: 320, height: 320, background: 'radial-gradient(circle, hsl(258 50% 40% / 0.065) 0%, transparent 65%)' }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 88% 78% at 42% 48%, transparent 30%, hsl(240 12% 4% / 0.65) 100%)' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-start w-full max-w-md px-16">
          {/* Logo lockup */}
          <div className="flex items-center gap-4 mb-14">
            <img src="/images/logo.svg" alt="QuiverDM" width={52} height={52} />
            <div className="flex flex-col gap-1">
              <span
                className="font-display text-xl font-bold tracking-[0.16em] leading-none"
                style={{ color: 'hsl(35 70% 88%)' }}
              >
                QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
              </span>
              <span
                className="text-[10px] tracking-[0.18em] uppercase font-medium"
                style={{ color: 'hsl(35 20% 46%)' }}
              >
                The DM&apos;s Second Brain
              </span>
            </div>
          </div>

          {/* Amber rule + headline */}
          <div className="h-px w-16 mb-4" style={{ background: 'linear-gradient(90deg, hsl(35 80% 55% / 0.4), transparent)' }} />
          <h1
            className="font-display text-[2rem] font-bold leading-tight mb-2"
            style={{ color: 'hsl(35 15% 88%)' }}
          >
            Command Every Session.
          </h1>
          <p className="text-sm" style={{ color: 'hsl(35 15% 46%)' }}>
            Your world. Alive.
          </p>
        </div>
      </div>

      {/* RIGHT FORM SLOT */}
      <div
        className="flex-1 lg:w-[45%] min-h-screen flex flex-col items-center justify-center px-10 py-12"
        style={{ background: 'hsl(240 10% 8%)', borderLeft: '1px solid hsl(35 35% 17%)' }}
      >
        {children}
      </div>
    </div>
  );
}
