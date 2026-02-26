import { QuiverApiClient, getModuleConfig } from "./api-client.js";
import { openQuiverSidecar } from "./sidecar.js";

const MODULE_ID = "quiverdm";
let client = null;
let importPollInterval = null;
let importPollInFlight = false;

function registerSettings() {
  game.settings.register(MODULE_ID, "baseUrl", {
    name: "QuiverDM Base URL",
    hint: "Example: https://app.quiverdm.com",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "apiKey", {
    name: "QuiverDM API Key",
    hint: "Generate this key in QuiverDM campaign settings.",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });
}

function createClient() {
  return new QuiverApiClient(getModuleConfig());
}

function syncClientFromSettings() {
  const { baseUrl, apiKey } = getModuleConfig();
  if (!baseUrl || !apiKey) {
    client = null;
    return null;
  }

  if (!client || client.baseUrl !== baseUrl.replace(/\/$/, "") || client.apiKey !== apiKey) {
    client = new QuiverApiClient({ baseUrl, apiKey });
  }

  return client;
}

async function registerHooks(client) {
  let capabilities;
  try {
    capabilities = await client.getCapabilities();
  } catch (error) {
    console.error("[quiverdm] Failed to load capabilities", error);
    return;
  }

  if (!capabilities?.features?.foundryBridge) {
    console.info("[quiverdm] Foundry bridge disabled by server flag");
    return;
  }

  if (!capabilities?.features?.eventIngestion) {
    return;
  }

  Hooks.on("combatRound", (combat) => {
    void client.sendEvent({
      type: "combat_round",
      payload: {
        round: combat?.round,
        combatId: combat?.id,
      },
    }).catch((error) => {
      console.error("[quiverdm] combatRound send failed", error);
    });
  });

  Hooks.on("combatStart", (combat) => {
    void client.sendEvent({
      type: "combat_start",
      payload: {
        combatId: combat?.id,
      },
    }).catch((error) => {
      console.error("[quiverdm] combatStart send failed", error);
    });
  });

  Hooks.on("deleteCombat", (combat) => {
    void client.sendEvent({
      type: "combat_end",
      payload: {
        combatId: combat?.id,
      },
    }).catch((error) => {
      console.error("[quiverdm] combat_end send failed", error);
    });
  });

  Hooks.on("updateActor", (actor, changes) => {
    const hpChanges = changes?.system?.attributes?.hp;
    if (!hpChanges || typeof hpChanges.value !== "number") {
      return;
    }

    const hpBefore = actor?.system?.attributes?.hp?.value;
    if (typeof hpBefore !== "number") {
      return;
    }

    const hpAfter = hpChanges.value;
    const delta = hpAfter - hpBefore;

    const type = hpAfter <= 0 ? "actor_death" : "hp_change";
    const payload = hpAfter <= 0
      ? {
          actorId: actor?.id,
          actorName: actor?.name,
          actorType: actor?.type === "character" ? "character" : "npc",
        }
      : {
          actorId: actor?.id,
          actorName: actor?.name,
          hpBefore,
          hpAfter,
          delta,
        };

    void client.sendEvent({ type, payload }).catch((error) => {
      console.error("[quiverdm] updateActor send failed", error);
    });
  });
}

function injectSidecarButton() {
  Hooks.on("renderSidebarTab", (app, html) => {
    if (app?.options?.id !== "settings") {
      return;
    }

    if (html.find(".quiverdm-open-sidecar").length > 0) {
      return;
    }

    const button = $(
      `<button type=\"button\" class=\"quiverdm-open-sidecar\" style=\"margin-top: 8px;\">Open QuiverDM Sidecar</button>`
    );

    button.on("click", () => {
      void openQuiverSidecar();
    });

    html.find(".settings-list").append(button);
  });
}

Hooks.once("init", () => {
  registerSettings();
  injectSidecarButton();
});

Hooks.once("ready", async () => {
  client = createClient();
  if (!client.isConfigured()) {
    console.info("[quiverdm] Module not configured yet.");
    return;
  }

  await registerHooks(client);
});

async function processImportJob(job, activeClient) {
  try {
    if (job.type === "npc") {
      const existing = game.actors.find((actor) => actor.flags?.quiverdm?.sourceId === job.sourceId);
      if (existing) {
        await existing.update(job.payload);
      } else {
        await Actor.createDocuments([job.payload]);
      }
      ui.notifications.info(`QuiverDM: Imported NPC "${job.sourceName}" to Actors`);
    } else if (job.type === "homebrew_item" || job.type === "homebrew_spell") {
      const existing = game.items.find((item) => item.flags?.quiverdm?.sourceId === job.sourceId);
      if (existing) {
        await existing.update(job.payload);
      } else {
        await Item.createDocuments([job.payload]);
      }
      ui.notifications.info(`QuiverDM: Imported "${job.sourceName}" to Items`);
    } else if (job.type === "session_journal") {
      const existing = game.journal.find((entry) => entry.flags?.quiverdm?.sourceId === job.sourceId);
      if (existing) {
        await existing.update(job.payload);
      } else {
        await JournalEntry.createDocuments([job.payload]);
      }
      ui.notifications.info(`QuiverDM: Imported session journal "${job.sourceName}"`);
    }

    await activeClient.ackImportJob(job.id, "delivered");
  } catch (error) {
    console.error("QuiverDM import error:", error);
    await activeClient.ackImportJob(job.id, "error", String(error));
  }
}

function startImportPoller() {
  if (importPollInterval) {
    clearInterval(importPollInterval);
  }

  importPollInterval = setInterval(async () => {
    const apiKey = game.settings.get(MODULE_ID, "apiKey");
    const baseUrl = game.settings.get(MODULE_ID, "baseUrl");
    if (!apiKey || !baseUrl || !game.user.isGM) {
      return;
    }

    const activeClient = syncClientFromSettings();
    if (!activeClient || importPollInFlight) {
      return;
    }

    importPollInFlight = true;
    try {
      const jobs = await activeClient.getPendingImports();
      for (const job of jobs) {
        await processImportJob(job, activeClient);
      }
    } catch (_error) {
      // Silent failure: server may be unavailable.
    } finally {
      importPollInFlight = false;
    }
  }, 5000);
}

Hooks.once("ready", () => {
  startImportPoller();
});
