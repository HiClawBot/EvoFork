import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const websiteRoot = fileURLToPath(new URL("..", import.meta.url));
const distRoot = join(websiteRoot, "dist");

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key?.startsWith("--") && value) {
    args.set(key.slice(2), value);
  }
}

const host = args.get("host") ?? "127.0.0.1";
const port = Number(args.get("port") ?? "4173");

execFileSync("tsx", ["scripts/build.ts"], {
  cwd: websiteRoot,
  stdio: "inherit"
});

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
  const normalizedPath = normalize(decodeURIComponent(requestUrl.pathname));
  const safePath = normalizedPath === "/" ? "index.html" : normalizedPath.replace(/^\/+/, "");
  const filePath = resolve(distRoot, safePath);
  const relativePath = relative(distRoot, filePath);

  if (relativePath.startsWith("..")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    const readablePath = fileStat.isDirectory() ? join(filePath, "index.html") : filePath;
    const body = await readFile(readablePath);
    response.writeHead(200, {
      "content-type": contentTypes.get(extname(readablePath)) ?? "application/octet-stream"
    });
    response.end(body);
  } catch {
    const fallback = await readFile(join(distRoot, "index.html"));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fallback);
  }
});

server.listen(port, host, () => {
  console.log(`EvoFork website: http://${host}:${port}`);
});
