import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const fixturesSource = join(packageRoot, "fixtures");
const fixturesTarget = join(packageRoot, "dist", "fixtures");

await mkdir(fixturesTarget, { recursive: true });
await cp(fixturesSource, fixturesTarget, { recursive: true });
