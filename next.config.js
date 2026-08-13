module.exports = {
  reactStrictMode: false,
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["discord.js", "@discordjs/ws", "@discordjs/rest", "@discordjs/builders"],
  // The Discord Gateway bot manager pulls in Node-only deps (discord.js, mongodb, crypto, timers, …)
  // and must only ever run in the long-running Node.js server. instrumentation.js loads it lazily and
  // only when NEXT_RUNTIME === "nodejs", but Next still *compiles* instrumentation for the edge
  // runtime, dragging that whole Node dependency chain into a graph that can't resolve Node built-ins.
  // Drop the module from every non-Node compile so those graphs never see it — register() never
  // reaches the import on edge anyway.
  webpack: (config, { nextRuntime, webpack }) => {
    if (nextRuntime !== "nodejs") {
      config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /(^|[\\/])discordBotManager/ }));
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "**",
      },
    ],
  },
};
