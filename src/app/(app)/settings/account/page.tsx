import { DangerZonePanel, PasswordSettingsPanel, SessionControlPanel } from '@/components/settings/panels';

export default function SettingsAccountPage() {
  return (
    <div className="space-y-6">
      <PasswordSettingsPanel />
      <SessionControlPanel />
      <DangerZonePanel />
    </div>
  );
}
