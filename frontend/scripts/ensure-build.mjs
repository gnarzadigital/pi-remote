import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const indexPath = join(root, "public", "index.html");

function needsBuild() {
  if (!existsSync(indexPath)) return true;
  const html = readFileSync(indexPath, "utf8");
  const assets = [...html.matchAll(/\/assets\/([^"']+)/g)].map((m) => m[1]);
  if (assets.length === 0) return true;
  return assets.some((asset) => !existsSync(join(root, "public", "assets", asset)));
}

if (needsBuild()) {
  console.log("pi-remote UI not built — running build:ui…");
  execSync("pnpm run build:ui", { cwd: root, stdio: "inherit" });
}
