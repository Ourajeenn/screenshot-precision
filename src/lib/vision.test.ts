import { describe, expect, it } from "vitest";
import { analyze, classify, DEFAULT_PARAMS, evaluate, iou, type Gray } from "./vision";
import { toCSV, validateControl } from "./store";

function synth(w: number, h: number, spots: { x: number; y: number; s: number }[]): Gray {
  const data = new Float32Array(w * h).fill(180);
  for (const p of spots)
    for (let y = p.y; y < p.y + p.s; y++) for (let x = p.x; x < p.x + p.s; x++) data[y * w + x] = 40;
  return { w, h, data };
}

describe("detection", () => {
  it("finds no zone on a uniform surface", () => {
    expect(analyze(synth(120, 120, []), DEFAULT_PARAMS).regions).toHaveLength(0);
  });
  it("finds two dark squares", () => {
    const r = analyze(synth(200, 200, [{ x: 20, y: 20, s: 15 }, { x: 120, y: 140, s: 20 }]), DEFAULT_PARAMS).regions;
    expect(r).toHaveLength(2);
  });
  it("drops regions below the minimum area", () => {
    const g = synth(200, 200, [{ x: 50, y: 50, s: 4 }]);
    expect(analyze(g, { ...DEFAULT_PARAMS, blurRadius: 0, opening: false, minArea: 40 }).regions).toHaveLength(0);
  });
  it("is reproducible", () => {
    const g = synth(150, 150, [{ x: 30, y: 30, s: 12 }]);
    expect(analyze(g, DEFAULT_PARAMS).regions).toEqual(analyze(g, DEFAULT_PARAMS).regions);
  });
});

describe("classification", () => {
  it("labels a thin elongated zone as a crack", () => {
    expect(classify({ circularity: 0.1, aspect: 8, contrast: 80, width: 60, height: 5 })).toBe("fissure");
  });
  it("labels a moderately elongated zone as a scratch", () => {
    expect(classify({ circularity: 0.3, aspect: 3, contrast: 60, width: 40, height: 13 })).toBe("rayure");
  });
  it("labels a dark round zone as a burn mark", () => {
    expect(classify({ circularity: 0.8, aspect: 1.1, contrast: 90, width: 20, height: 20 })).toBe("brulure");
  });
  it("labels a faint round zone as a pit", () => {
    expect(classify({ circularity: 0.8, aspect: 1.1, contrast: 25, width: 20, height: 20 })).toBe("cavite");
  });
  it("labels an analyzed dark square", () => {
    const r = analyze(synth(150, 150, [{ x: 30, y: 30, s: 14 }]), DEFAULT_PARAMS).regions[0]!;
    expect(r.kind).toBeDefined();
    expect(["brulure", "cavite", "tache"]).toContain(r.kind);
  });
});

describe("evaluation", () => {
  it("computes IoU", () => {
    expect(iou({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 0, width: 10, height: 10 })).toBeCloseTo(1 / 3);
  });
  it("computes precision and recall", () => {
    const e = evaluate(
      [{ x: 0, y: 0, width: 10, height: 10 }, { x: 50, y: 50, width: 5, height: 5 }],
      [{ x: 1, y: 1, width: 10, height: 10 }, { x: 90, y: 90, width: 5, height: 5 }],
    );
    expect(e).toMatchObject({ tp: 1, fp: 1, fn: 1, precision: 0.5, recall: 0.5 });
  });
});

describe("controls", () => {
  it("requires a reference", () => {
    expect(validateControl({ reference: " ", decision: "Conforme" })).not.toBeNull();
  });
  it("escapes CSV quotes", () => {
    const csv = toCSV([{ id: "a", createdAt: "t", reference: 'R"1', imageName: "i", regions: [], decision: "À vérifier", comment: "" } as never]);
    expect(csv.split("\n")[1]).toContain('"R""1"');
  });
});
