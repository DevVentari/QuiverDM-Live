const MODULE_ID = "quiverdm";

export class QuiverApiClient {
  constructor({ baseUrl, apiKey }) {
    this.baseUrl = (baseUrl || "").replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async request(path, options = {}) {
    if (!this.isConfigured()) {
      throw new Error("QuiverDM module is not configured");
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`QuiverDM request failed (${response.status}): ${body}`);
    }

    return response.json();
  }

  async getCapabilities() {
    return this.request("/api/integrations/foundry/capabilities", { method: "GET" });
  }

  async getLaunchToken() {
    return this.request("/api/integrations/foundry/launch-token", { method: "GET" });
  }

  async sendEvent(event) {
    return this.request("/api/integrations/foundry/events", {
      method: "POST",
      body: JSON.stringify({
        ...event,
        foundryTimestamp: new Date().toISOString(),
      }),
    });
  }
}

export function getModuleConfig() {
  return {
    baseUrl: game.settings.get(MODULE_ID, "baseUrl"),
    apiKey: game.settings.get(MODULE_ID, "apiKey"),
  };
}
