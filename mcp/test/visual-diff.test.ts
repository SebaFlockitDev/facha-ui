import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "skills", "apply", "scripts", "visual-diff.mjs");

type Img = { width: number; height: number; data: Buffer };
let m: {
  decodePng: (b: Buffer) => Img;
  encodePng: (i: Img) => Buffer;
  diffImages: (a: Img, b: Img) => { image: Img; summary: any };
};
beforeAll(async () => {
  m = await import(pathToFileURL(SCRIPT).href);
});

/** A white image with an optional colored block. */
function image(width: number, height: number, block?: { x: number; y: number; w: number; h: number }): Img {
  const data = Buffer.alloc(width * height * 4, 255);
  if (block) {
    for (let y = block.y; y < block.y + block.h; y++) {
      for (let x = block.x; x < block.x + block.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = 20; data[i + 1] = 80; data[i + 2] = 200;
      }
    }
  }
  return { width, height, data };
}

describe("visual diff (apply)", () => {
  it("encodes and decodes PNG without dependencies", () => {
    const img = image(40, 30, { x: 5, y: 5, w: 10, h: 10 });
    const back = m.decodePng(m.encodePng(img));
    expect(back.width).toBe(40);
    expect(back.height).toBe(30);
    expect(back.data.equals(img.data)).toBe(true);
  });

  it("finds no change between equal captures", () => {
    const a = image(64, 64, { x: 0, y: 0, w: 8, h: 8 });
    expect(m.diffImages(a, a).summary).toMatchObject({ changedPixels: 0, changedPercent: 0, regions: [] });
  });

  it("marks what changed and outlines the region", () => {
    const before = image(128, 128);
    const after = image(128, 128, { x: 64, y: 32, w: 40, h: 20 });
    const { summary, image: out } = m.diffImages(before, after);
    expect(summary.changedPixels).toBe(800);
    expect(summary.regions).toEqual([{ x: 64, y: 32, width: 64, height: 32 }]);
    const i = (40 * 128 + 70) * 4; // inside the block
    expect([out.data[i], out.data[i + 1], out.data[i + 2]]).toEqual([230, 40, 40]);
  });

  it("reports a height change as changed area", () => {
    const { summary } = m.diffImages(image(32, 32), image(32, 48));
    expect(summary.heightChange).toBe(16);
    expect(summary.changedPixels).toBe(32 * 16);
  });
});
