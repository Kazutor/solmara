// SOLMARA entrypoint: copies game/ and screenshots/ next to this file into the
// output directory, then writes /output/dossier.json with buildDossier.
import { buildDossier } from "./vendor/makefun-game.ts";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(join(repoRoot, "game"), join(outDir, "game"), { recursive: true });
await cp(join(repoRoot, "screenshots"), join(outDir, "screenshots"), {
  recursive: true,
});

const dossier = await buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots_max: 4,
  screenshots_max_bytes: 262144,
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
await writeFile(join(outDir, "dossier.json"), dossier);

console.log("dossier written to " + join(outDir, "dossier.json"));
