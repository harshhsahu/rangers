module.exports = {
  reactStrictMode: false,
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["discord.js", "@discordjs/ws", "@discordjs/rest", "@discordjs/builders"],
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
