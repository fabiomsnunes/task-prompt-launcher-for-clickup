import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const errors = [];

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version must be 3");
}

if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push(`invalid version: ${manifest.version}`);
}

// Without the key the extension ID follows the folder it is loaded from, and a
// move silently becomes a new extension that has lost its saved options.
if (!manifest.key) {
  errors.push("missing key: the extension ID would depend on the folder it is loaded from");
}

const referenced = [
  manifest.options_ui?.page,
  manifest.background?.service_worker,
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.content_scripts ?? []).flatMap((entry) => [
    ...(entry.js ?? []),
    ...(entry.css ?? []),
  ]),
].filter(Boolean);

for (const file of referenced) {
  if (!existsSync(file)) errors.push(`missing file: ${file}`);
}

const scripts = referenced.filter((file) => file.endsWith(".js")).concat("options.js");

for (const file of scripts) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    errors.push(`syntax error in ${file}: ${error.stderr?.toString().trim()}`);
  }
}

if (errors.length) {
  console.error(errors.map((line) => `x ${line}`).join("\n"));
  process.exit(1);
}

console.log(`ok: ${manifest.name} ${manifest.version}, ${referenced.length} referenced files`);
