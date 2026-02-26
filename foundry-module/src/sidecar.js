import { QuiverApiClient, getModuleConfig } from "./api-client.js";

export async function openQuiverSidecar() {
  const client = new QuiverApiClient(getModuleConfig());
  if (!client.isConfigured()) {
    ui.notifications.warn("Configure QuiverDM base URL and API key first.");
    return;
  }

  try {
    const launch = await client.getLaunchToken();
    window.open(launch.launchUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    console.error("[quiverdm] Failed to open sidecar", error);
    ui.notifications.error("Failed to open QuiverDM sidecar.");
  }
}
