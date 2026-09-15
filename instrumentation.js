/**
 * Next.js instrumentation — start Discord Gateway clients when the Node server boots.
 * Requires a long-running Node process (standalone / Docker / VPS). Not reliable on serverless.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Some hosts (containers/sandboxes without a working IPv6 route) have Node's fetch
  // try an IPv6 address first, hit an unreachable-network error, and fail outright
  // instead of falling back to IPv4 the way curl and browsers do. Preferring IPv4
  // first avoids those outbound fetch failures, such as the ones made when
  // verifying an agent's session against the GTWY server.
  try {
    const dns = await import("dns");
    dns.setDefaultResultOrder("ipv4first");
  } catch (err) {
    console.error("[net] failed to set DNS result order", err?.message || err);
  }

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
