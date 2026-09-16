import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";

// Os ficheiros que entram na extensao. Tudo o resto (workflows, scripts,
// README) fica de fora do que e carregado no browser.
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

const zip = `clickup-claude-launcher-v${version}.zip`;
rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-q", `../${zip}`, "."], { cwd: "dist" });

console.log(`dist/ e ${zip} prontos (v${version})`);
