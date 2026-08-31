/**
 * ViaSocket embed script identity.
 *
 * Hardcoded rather than read from NEXT_PUBLIC_EMBED_SCRIPT_* on purpose: those
 * are inlined at build time, and the Docker build does not export its ARGs as
 * env vars, so they resolved to undefined in production and the script silently
 * never loaded. These values are the same across environments and are public
 * (the script URL ships in the client bundle either way).
 */
export const EMBED_SCRIPT_ID = "viasocket-embed-main-script";
export const EMBED_SCRIPT_SRC = "https://embed.viasocket.com/prod-embedcomponent.js";
