import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { processAndValidateSignaturePng } from "./signature-processing.service.js";

async function writeTempPng(pixels, width, height, { opaque = false } = {}) {
  // pixels: Array of {x,y,r,g,b,a} content strokes on transparent canvas
  const raw = Buffer.alloc(width * height * 4, 0);
  if (opaque) {
    for (let i = 0; i < width * height; i += 1) {
      raw[i * 4] = 255;
      raw[i * 4 + 1] = 255;
      raw[i * 4 + 2] = 255;
      raw[i * 4 + 3] = 255;
    }
  }
  for (const p of pixels) {
    const i = (p.y * width + p.x) * 4;
    raw[i] = p.r ?? 0;
    raw[i + 1] = p.g ?? 0;
    raw[i + 2] = p.b ?? 0;
    raw[i + 3] = p.a ?? 255;
  }
  const buf = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const file = path.join(os.tmpdir(), `sig-test-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  await fs.writeFile(file, buf);
  return file;
}

test("rejects opaque PNG without meaningful transparency", async () => {
  const file = await writeTempPng(
    [{ x: 100, y: 50, r: 0, g: 0, b: 0, a: 255 }],
    600,
    200,
    { opaque: true },
  );
  await assert.rejects(() => processAndValidateSignaturePng(file), /trong suốt/);
  await fs.unlink(file).catch(() => {});
});

test("crops transparent padding and accepts valid signature", async () => {
  const w = 800;
  const h = 400;
  const pixels = [];
  // small ink blob in center
  for (let y = 180; y < 220; y += 1) {
    for (let x = 350; x < 450; x += 1) {
      pixels.push({ x, y, r: 20, g: 20, b: 20, a: 255 });
    }
  }
  const file = await writeTempPng(pixels, w, h);
  const result = await processAndValidateSignaturePng(file);
  assert.equal(result.cropped, true);
  assert.ok(result.width < w);
  assert.ok(result.height < h);
  assert.ok(result.bytes > 0);
  await fs.unlink(file).catch(() => {});
});

test("rejects empty transparent image", async () => {
  const file = await writeTempPng([], 600, 200);
  await assert.rejects(() => processAndValidateSignaturePng(file), /trống|nét chữ/);
  await fs.unlink(file).catch(() => {});
});
