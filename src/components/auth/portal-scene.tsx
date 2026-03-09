interface PortalSceneProps {
  children: React.ReactNode;
}

export function PortalScene({ children }: PortalSceneProps) {
  return (
    <div className="auth-scene relative min-h-screen w-full overflow-hidden flex items-center justify-center dark">
      {/* Static background image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/login-bg.jpg')" }} />

      {/* Gradient fallback + darken */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, hsl(240 15% 6% / 0.55) 0%, hsl(25 20% 8% / 0.45) 50%, hsl(240 10% 5% / 0.55) 100%)' }} />

      {/* Soft vignette — edges dark, center open */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 40%, hsl(240 10% 4% / 0.75) 100%)' }} />

      {/* Ambient amber glow behind form */}
      <div className="auth-scene-glow absolute pointer-events-none" style={{ width: 560, height: 560, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(circle, hsl(35 80% 55% / 0.08) 0%, transparent 70%)' }} />

      {/* Form */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
