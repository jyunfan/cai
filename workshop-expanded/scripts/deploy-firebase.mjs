import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const siteId = process.env.FIREBASE_SITE || "cai-agent-workshop-20261007";
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "cai-agent-workshop-20261007";
const publicDir = resolve(process.env.FIREBASE_PUBLIC || "dist-google");
const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const api = "https://firebasehosting.googleapis.com/v1beta1";

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Goog-User-Project": projectId,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body}`);
  return body ? JSON.parse(body) : {};
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

const paths = await listFiles(publicDir);
const assets = new Map();
const files = {};
for (const path of paths) {
  const compressed = gzipSync(await readFile(path), { level: 9, mtime: 0 });
  const hash = createHash("sha256").update(compressed).digest("hex");
  const publicPath = `/${relative(publicDir, path).split(sep).join("/")}`;
  files[publicPath] = hash;
  assets.set(hash, compressed);
}

const version = await request(`${api}/sites/${siteId}/versions`, {
  method: "POST",
  body: JSON.stringify({
    config: {
      headers: [
        { glob: "**", headers: { "Cache-Control": "public, max-age=300" } },
        { glob: "assets/**", headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
      ],
    },
  }),
});

const populated = await request(`${api}/${version.name}:populateFiles`, {
  method: "POST",
  body: JSON.stringify({ files }),
});

for (const hash of populated.uploadRequiredHashes || []) {
  const response = await fetch(`${populated.uploadUrl}/${hash}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Goog-User-Project": projectId,
      "Content-Type": "application/octet-stream",
    },
    body: assets.get(hash),
  });
  if (!response.ok) throw new Error(`Upload ${hash} failed: ${response.status} ${await response.text()}`);
}

await request(`${api}/${version.name}?update_mask=status`, {
  method: "PATCH",
  body: JSON.stringify({ status: "FINALIZED" }),
});

const release = await request(
  `${api}/sites/${siteId}/releases?versionName=${encodeURIComponent(version.name)}`,
  { method: "POST" },
);

console.log(JSON.stringify({
  site: `https://${siteId}.web.app`,
  version: version.name,
  release: release.name,
  files: paths.length,
}, null, 2));
