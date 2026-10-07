import assert from "node:assert/strict";
import test from "node:test";
import { access } from "node:fs/promises";
import { workshopSlides } from "../app/workshop-slides.ts";

test("six teaching modules each contain exactly sixty minutes", () => {
  const totals = new Map();
  for (const slide of workshopSlides) totals.set(slide.module, (totals.get(slide.module) ?? 0) + slide.minutes);
  const modules = [...totals].filter(([name]) => /^0[1-6]/.test(name));
  assert.equal(modules.length, 6);
  for (const [name, minutes] of modules) assert.equal(minutes, 60, name);
  assert.equal(totals.get("午休"), 0);
  assert.equal(totals.get("附錄"), 0);
});

test("illustrated slides retain local visuals and current event details", async () => {
  assert.ok(workshopSlides.filter(slide => slide.image || slide.portraits).length >= 10);
  for (const slide of workshopSlides) {
    if (slide.image) await access(new URL(`../public${slide.image.src}`, import.meta.url));
  }
  for (let i=1; i<=3; i++) await access(new URL(`../public/images/turing-${i}.jpg`, import.meta.url));
  assert.match(workshopSlides[0].points.join(" "), /K53/);
  const history = workshopSlides.find(slide => slide.title === "2012 年後的 AI 發展");
  assert.ok(history?.portraits);
  assert.doesNotMatch(JSON.stringify(history), /1955|1956|Dartmouth/);
  assert.match(history.notes, /2019/);
});

test("every slide contains teaching content and speaker guidance", () => {
  for (const slide of workshopSlides) {
    assert.ok(slide.title && slide.subtitle && slide.notes, slide.title);
    assert.ok(slide.points?.length || slide.rows?.length || slide.prompt || slide.legacy !== undefined, slide.title);
    if (slide.rows) assert.ok(slide.rows.every(row => row.length === slide.rows[0].length), slide.title);
    if (slide.legacy !== undefined) assert.ok(slide.legacy >= 1 && slide.legacy <= 10);
  }
});
