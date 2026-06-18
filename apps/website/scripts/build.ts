import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(websiteRoot, "src");
const distRoot = join(websiteRoot, "dist");
const distAssets = join(distRoot, "assets");

await rm(distRoot, { recursive: true, force: true });
await mkdir(distAssets, { recursive: true });

execFileSync("tsc", ["-p", "tsconfig.app.json"], {
  cwd: websiteRoot,
  stdio: "inherit"
});

const html = await readFile(join(srcRoot, "index.html"), "utf8");
const stampedHtml = html.replace(
  "<!-- build:version -->",
  `<meta name="evofork-version" content="0.4.1">`
);

await writeFile(join(distRoot, "index.html"), stampedHtml);
await copyFile(join(srcRoot, "styles.css"), join(distAssets, "styles.css"));

console.log(`Built EvoFork website at ${distRoot}`);
