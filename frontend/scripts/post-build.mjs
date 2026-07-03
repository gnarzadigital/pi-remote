import { unlinkSync, existsSync, readdirSync, readFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const publicDir = join(root, "public");
const assetsDir = join(publicDir, "assets");

for (const f of ["client.js", "style.css"]) {
  const p = join(publicDir, f);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log(`removed legacy ${f}`);
  }
}

function collectAssetRefs(text) {
  return [...text.matchAll(/\/assets\/([^"')]+)/g)].map((m) => m[1]);
}

const indexPath = join(publicDir, "index.html");
if (!existsSync(indexPath)) process.exit(0);

const keep = new Set(collectAssetRefs(readFileSync(indexPath, "utf8")));

for (const ref of [...keep]) {
  const cssPath = join(assetsDir, ref);
  if (ref.endsWith(".css") && existsSync(cssPath)) {
    for (const nested of collectAssetRefs(readFileSync(cssPath, "utf8"))) {
      keep.add(nested);
    }
  }
}

// Ground truth for chunks only reachable via a runtime import() (e.g.
// code-block.tsx's lazy import from markdown.tsx) — these are never statically
// referenced in index.html or any CSS, so the scan above always misses them and
// would delete them right after this exact build produced them. Requires
// `build.manifest: true` in vite.config.ts.
const manifestPath = join(assetsDir, "..", ".vite", "manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const entry of Object.values(manifest)) {
    if (entry.file) keep.add(entry.file.replace(/^assets\//, ""));
    for (const css of entry.css ?? []) keep.add(css.replace(/^assets\//, ""));
    for (const asset of entry.assets ?? []) keep.add(asset.replace(/^assets\//, ""));
  }
  rmSync(join(assetsDir, "..", ".vite"), { recursive: true, force: true });
}

if (existsSync(assetsDir)) {
  for (const file of readdirSync(assetsDir)) {
    if (!keep.has(file)) {
      unlinkSync(join(assetsDir, file));
      console.log(`removed stale asset ${file}`);
    }
  }
}
