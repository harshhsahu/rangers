/**
 * Next.js instrumentation. Edge compiles this file; keep Node built-ins out of it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerNode } = await import("./instrumentation.node.js");
  await registerNode();
}
