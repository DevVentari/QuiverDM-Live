import { DangerZonePanel, PasswordSettingsPanel, SessionControlPanel } from '@/components/settings/panels';

export default function SettingsAccountPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="label-overline mb-1">Settings</p>
        <div className="section-rule" />
        <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
          Account
        </h1>
      </div>
      <PasswordSettingsPanel />
      <SessionControlPanel />
      <DangerZonePanel />
    </div>
  );
}
