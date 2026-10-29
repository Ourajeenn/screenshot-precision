// Pure, deterministic image-processing functions (no DOM). Same input + params => same output.

export type Gray = { w: number; h: number; data: Float32Array };

export type Method = "otsu" | "sigma";

export interface Params {
  blurRadius: number; // box-blur radius (3 passes ≈ gaussian), 0 = off
  illumination: boolean; // subtract heavily blurred background
  illumRadius: number;
  contrast: boolean; // histogram equalization
  method: Method;
  sigmaK: number; // for "sigma": pixel < mean - k·std
  opening: boolean; // 3x3 morphological opening
  minArea: number; // px
}

export const DEFAULT_PARAMS: Params = {
  blurRadius: 2,
  illumination: true,
  illumRadius: 40,
  contrast: false,
  method: "sigma",
  sigmaK: 2.5,
  opening: true,
  minArea: 40,
};

export interface Region {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  /** 4π·area/perimeter² : 1 = disque parfait, proche de 0 = forme étirée/découpée */
  circularity: number;
  /** rapport long côté / petit côté du rectangle englobant (>= 1) */
  aspect: number;
  /** écart moyen entre la zone et le fond environnant (niveaux de gris, positif = plus sombre) */
  contrast: number;
  /** description visuelle probable, issue de classify() */
  kind: RegionKind;
}

export type RegionKind = "fissure" | "rayure" | "cavite" | "brulure" | "decoloration" | "tache";

export const KIND_LABELS: Record<RegionKind, string> = {
  fissure: "Fissure / fente fine",
  rayure: "Rayure / trace linéaire",
  cavite: "Cavité / piqûre",
  brulure: "Marque sombre / brûlure",
  decoloration: "Décoloration",
  tache: "Tache / zone sombre",
};

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Gray {
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    data[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  }
  return { w, h, data };
}

function boxPass(src: Float32Array, w: number, h: number, r: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(w * h);
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  for (let l = 0; l < lines; l++) {
    const idx = (k: number) => (horizontal ? l * w + k : k * w + l);
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[idx(Math.min(len - 1, Math.max(0, k)))]!;
    for (let k = 0; k < len; k++) {
      out[idx(k)] = sum / (2 * r + 1);
      const add = Math.min(len - 1, k + r + 1);
      const rem = Math.max(0, k - r);
      sum += src[idx(add)]! - src[idx(rem)]!;
    }
  }
  return out;
}

export function blur(g: Gray, r: number): Gray {
  if (r <= 0) return { ...g, data: g.data.slice() };
  let d = g.data;
  for (let p = 0; p < 3; p++) {
    d = boxPass(d, g.w, g.h, r, true);
    d = boxPass(d, g.w, g.h, r, false);
  }
  return { w: g.w, h: g.h, data: d };
}

export function correctIllumination(g: Gray, r: number): Gray {
  const bg = blur(g, r);
  const data = new Float32Array(g.data.length);
  for (let i = 0; i < data.length; i++) data[i] = Math.min(255, Math.max(0, g.data[i]! - bg.data[i]! + 128));
  return { w: g.w, h: g.h, data };
}

export function equalize(g: Gray): Gray {
  const hist = new Array<number>(256).fill(0);
  for (const v of g.data) hist[Math.round(v)]!++;
  const cdf: number[] = [];
  let acc = 0;
  for (let i = 0; i < 256; i++) cdf[i] = acc += hist[i]!;
  const min = cdf.find((c) => c > 0) ?? 0;
  const n = g.data.length;
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = n === min ? g.data[i]! : ((cdf[Math.round(g.data[i]!)]! - min) / (n - min)) * 255;
  return { w: g.w, h: g.h, data };
}

export function otsuThreshold(g: Gray): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of g.data) hist[Math.round(v)]!++;
  const n = g.data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]!;
  let sumB = 0, wB = 0, best = 0, t = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!;
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i]!;
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; t = i; }
  }
  return t;
}

/** Binary mask of dark (suspect) pixels. */
export function segment(g: Gray, p: Params): { mask: Uint8Array; threshold: number } {
  let threshold: number;
  if (p.method === "otsu") threshold = otsuThreshold(g);
  else {
    let s = 0, s2 = 0;
    for (const v of g.data) { s += v; s2 += v * v; }
    const m = s / g.data.length;
    const sd = Math.sqrt(Math.max(0, s2 / g.data.length - m * m));
    // A flat image (σ < 1 grey level) has no outlier pixels.
    threshold = sd < 1 ? -Infinity : m - p.sigmaK * sd;
  }
  const mask = new Uint8Array(g.data.length);
  for (let i = 0; i < mask.length; i++) mask[i] = g.data[i]! <= threshold ? 1 : 0;
  return { mask, threshold };
}

function morph(mask: Uint8Array, w: number, h: number, erode: boolean): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy)), xx = Math.min(w - 1, Math.max(0, x + dx));
          const m = mask[yy * w + xx]!;
          if (erode) v &= m; else v |= m;
        }
      out[y * w + x] = v;
    }
  return out;
}

export function opening(mask: Uint8Array, w: number, h: number): Uint8Array {
  return morph(morph(mask, w, h, true), w, h, false);
}

/** 8-connected components → bounding boxes + shape stats, filtered by min area. */
export function findRegions(mask: Uint8Array, w: number, h: number, minArea: number, gray?: Float32Array): Region[] {
  const seen = new Uint8Array(mask.length);
  const regions: Region[] = [];
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0, sum = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % w, y = (j - x) / w;
      area++;
      if (gray) sum += gray[j]!;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const k = yy * w + xx;
          if (mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
        }
    }
    if (area < minArea) continue;
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    // Perimeter: region edges touching background (4-neighborhood).
    let per = 0;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        if (!mask[y * w + x]) continue;
        if (x === 0 || !mask[y * w + x - 1]) per++;
        if (x === w - 1 || !mask[y * w + x + 1]) per++;
        if (y === 0 || !mask[(y - 1) * w + x]) per++;
        if (y === h - 1 || !mask[(y + 1) * w + x]) per++;
      }
    const circularity = Math.min(1, (4 * Math.PI * area) / (per * per));
    const aspect = Math.max(bw, bh) / Math.min(bw, bh);
    // Contrast: mean gray inside the region vs a 4px ring around its box.
    let contrast = 0;
    if (gray) {
      const m = 4;
      const rx0 = Math.max(0, minX - m), ry0 = Math.max(0, minY - m);
      const rx1 = Math.min(w - 1, maxX + m), ry1 = Math.min(h - 1, maxY + m);
      let ringSum = 0, ringN = 0;
      for (let y = ry0; y <= ry1; y++)
        for (let x = rx0; x <= rx1; x++) {
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) continue;
          ringSum += gray[y * w + x]!; ringN++;
        }
      contrast = ringN ? ringSum / ringN - sum / area : 0;
    }
    regions.push({ id: 0, x: minX, y: minY, width: bw, height: bh, area, circularity, aspect, contrast, kind: "tache" });
  }
  regions.sort((a, b) => b.area - a.area);
  regions.forEach((r, i) => (r.id = i + 1));
  for (const r of regions) r.kind = classify(r);
  return regions;
}

/** Visual guess from shape + contrast. Deterministic, no learning. */
export function classify(r: Pick<Region, "circularity" | "aspect" | "contrast" | "width" | "height">): RegionKind {
  const thin = Math.min(r.width, r.height);
  if (r.aspect >= 5 || (r.aspect >= 3 && thin <= 10)) return "fissure";
  if (r.aspect >= 2.5) return "rayure";
  if (r.circularity >= 0.55) return r.contrast >= 50 ? "brulure" : "cavite";
  if (r.contrast < 15) return "decoloration";
  return "tache";
}

export function preprocess(g: Gray, p: Params): Gray {
  let out = blur(g, p.blurRadius);
  if (p.illumination) out = correctIllumination(out, p.illumRadius);
  if (p.contrast) out = equalize(out);
  return out;
}

export function analyze(g: Gray, p: Params) {
  const t0 = performance.now();
  const pre = preprocess(g, p);
  const seg = segment(pre, p);
  const mask = p.opening ? opening(seg.mask, g.w, g.h) : seg.mask;
  const regions = findRegions(mask, g.w, g.h, p.minArea, pre.data);
  return { pre, regions, threshold: seg.threshold, ms: performance.now() - t0 };
}

// ---- Evaluation ----
export type Box = { x: number; y: number; width: number; height: number };

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** Greedy one-to-one matching at IoU >= thr. */
export function evaluate(pred: Box[], truth: Box[], thr = 0.5) {
  const used = new Set<number>();
  let tp = 0;
  for (const p of pred) {
    let best = -1, bestV = thr;
    truth.forEach((t, i) => {
      if (used.has(i)) return;
      const v = iou(p, t);
      if (v >= bestV) { bestV = v; best = i; }
    });
    if (best >= 0) { used.add(best); tp++; }
  }
  const fp = pred.length - tp, fn = truth.length - tp;
  return {
    tp, fp, fn,
    precision: pred.length ? tp / pred.length : null,
    recall: truth.length ? tp / truth.length : null,
  };
}
