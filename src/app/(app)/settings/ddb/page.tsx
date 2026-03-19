import { DdbLibraryGrid } from '@/components/settings/ddb/DdbLibraryGrid';

export default function DdbSettingsPage() {
  return (
    <div className="max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
      <div>
        <p className="font-cinzel text-xs tracking-widest text-amber-400/70 uppercase mb-1">Integration</p>
        <h1 className="text-2xl font-cinzel text-amber-400">D&D Beyond Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import sourcebooks from your D&D Beyond account into your campaigns.
        </p>
      </div>
      <DdbLibraryGrid />
    </div>
  );
}
