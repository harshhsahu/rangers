/**
 * Next.js instrumentation — start Discord Gateway clients when the Node server boots.
 * Requires a long-running Node process (standalone / Docker / VPS). Not reliable on serverless.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { syncDiscordBotsFromDb } = await import("@/lib/discordBotManager");
    // Delay slightly so Mongo / env are ready
    setTimeout(() => {
      syncDiscordBotsFromDb()
        .then((r) => console.log("[discord] boot sync", r))
        .catch((err) => console.error("[discord] boot sync failed", err?.message || err));
    }, 1500);
  } catch (err) {
    console.error("[discord] instrumentation register failed", err?.message || err);
  }
}
