import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const errors = [];

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version tem de ser 3");
}

if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push(`version invalida: ${manifest.version}`);
}

const referenced = [
  manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.content_scripts ?? []).flatMap((entry) => [
    ...(entry.js ?? []),
    ...(entry.css ?? []),
  ]),
].filter(Boolean);

for (const file of referenced) {
  if (!existsSync(file)) errors.push(`ficheiro em falta: ${file}`);
}

for (const file of ["content.js", "options.js"]) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    errors.push(`erro de sintaxe em ${file}: ${error.stderr?.toString().trim()}`);
  }
}

if (errors.length) {
  console.error(errors.map((line) => `x ${line}`).join("\n"));
  process.exit(1);
}

console.log(`ok: ${manifest.name} ${manifest.version}, ${referenced.length} ficheiros referenciados`);
