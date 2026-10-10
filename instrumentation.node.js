/**
 * Node-only boot work. Loaded from instrumentation.js only when NEXT_RUNTIME is nodejs
 * so the Edge compiler never sees `dns` or Discord.
 */
export async function registerNode() {
  try {
    const dns = await import("dns");
    dns.setDefaultResultOrder("ipv4first");
  } catch (err) {
    console.error("[net] failed to set DNS result order", err?.message || err);
  }

  try {
    const { syncDiscordBotsFromDb } = await import("@/lib/discordBotManager");
    setTimeout(() => {
      syncDiscordBotsFromDb()
        .then((r) => console.log("[discord] boot sync", r))
        .catch((err) => console.error("[discord] boot sync failed", err?.message || err));
    }, 1500);
  } catch (err) {
    console.error("[discord] instrumentation register failed", err?.message || err);
  }
}
