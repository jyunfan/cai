import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { registerHooks } from "node:module";

// The root-page smoke test runs in Node and never queries D1. API behavior is
// covered with SQLite and a separate real Worker/browser integration run.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return {url: "data:text/javascript,export const env = {};", shortCircuit: true};
    return nextResolve(specifier, context);
  },
});

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished workshop deck", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-Hant">/i);
  assert.match(html, /<title>不在辦公室，也能辦公事｜手機、平板與 AI Agent 工作坊<\/title>/i);
  assert.match(html, /不在辦公室，也能辦公事/);
  assert.match(html, /K53/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("includes the 4x4 bilingual game and presentation controls", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.match(page, /const WORD_PAIRS = \[/);
  assert.equal((page.match(/accent: "/g) ?? []).length, 8);
  assert.match(css, /grid-template-columns:repeat\(4,1fr\)/);
  assert.match(page, /first\.pairId === second\.pairId/);
  assert.match(page, /1200 - Math\.max\(0, moves - 8\) \* 70/);
  assert.match(page, /ArrowRight/);
  assert.match(page, /開啟遊戲 Demo/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
