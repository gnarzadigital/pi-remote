import { unlinkSync, existsSync, readdirSync, readFileSync } from "fs";
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

if (existsSync(assetsDir)) {
  for (const file of readdirSync(assetsDir)) {
    if (!keep.has(file)) {
      unlinkSync(join(assetsDir, file));
      console.log(`removed stale asset ${file}`);
    }
  }
}
