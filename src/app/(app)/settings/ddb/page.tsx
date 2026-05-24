import { DdbLibraryGrid } from '@/components/settings/ddb/DdbLibraryGrid';

export default function DdbSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-[1.1rem] border border-[var(--q-border)] bg-[var(--q-surface-inset)] p-5">
        <p className="label-overline">Integrations</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-wide text-foreground">D&amp;D Beyond Library</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--q-text-dim)]">
          Import sourcebooks from your D&D Beyond account into your campaigns.
        </p>
      </div>
      <DdbLibraryGrid />
    </div>
  );
}
