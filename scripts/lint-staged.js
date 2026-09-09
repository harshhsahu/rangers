const { spawn } = require("child_process");
const path = require("path");

const nextBin = path.join(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

const files = process.argv.slice(2);

// If no files are passed, just exit
if (files.length === 0) {
  process.exit(0);
}

const args = ["lint", "--fix", "--no-cache"];
files.forEach((file) => {
  args.push("--file", file);
});

console.log(`Running next lint on ${files.length} files...`);

const child = spawn(nextBin, args, {
  stdio: "inherit",
});

child.on("close", (code) => {
  if (code !== 0) {
    console.error("\n\x1b[31mLinting failed! Please fix the errors above.\x1b[0m");
    process.exit(code);
  }
  process.exit(0);
});
