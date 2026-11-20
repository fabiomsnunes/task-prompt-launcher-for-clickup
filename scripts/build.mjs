import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";

// The files that ship in the extension. Everything else (workflows, scripts,
// README) stays out of what the browser loads.
const SHIPPED = [
  "manifest.json",
  "content.js",
  "background.js",
  "styles.css",
  "options.html",
  "options.css",
  "options.js",
  "icons",
];

const version = JSON.parse(readFileSync("manifest.json", "utf8")).version;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");

for (const entry of SHIPPED) {
  cpSync(entry, `dist/${entry}`, { recursive: true });
}

const zip = `task-prompt-launcher-for-clickup-v${version}.zip`;
rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-q", `../${zip}`, "."], { cwd: "dist" });

console.log(`dist/ and ${zip} ready (v${version})`);
