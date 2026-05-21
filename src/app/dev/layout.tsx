export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen overflow-y-auto">
      {children}
    </div>
  );
}
