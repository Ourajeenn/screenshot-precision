// Browser-only helpers (call from event handlers / effects).
import type { Gray, Region } from "./vision";

export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_SIDE = 1600; // larger images are downscaled for analysis (recorded)

export interface LoadedImage {
  name: string;
  type: string;
  bytes: number;
  hash: string;
  origWidth: number;
  origHeight: number;
  scale: number;
  canvas: HTMLCanvasElement;
  rgba: ImageData;
}

export async function loadImage(file: File): Promise<LoadedImage> {
  if (!file.size) throw new Error("Le fichier est vide.");
  if (file.size > MAX_BYTES) throw new Error(`Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo).`);
  if (!/\.(jpe?g|png)$/i.test(file.name)) throw new Error("Formats acceptés : JPG, JPEG, PNG.");
  const buf = await file.arrayBuffer();
  const sig = new Uint8Array(buf.slice(0, 4));
  const isPng = sig[0] === 0x89 && sig[1] === 0x50;
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8;
  if (!isPng && !isJpg) throw new Error("Le contenu du fichier n'est pas une image JPG/PNG valide.");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([buf]));
  } catch {
    throw new Error("Image corrompue : impossible de la décoder.");
  }
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hash = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return {
    name: file.name,
    type: isPng ? "PNG" : "JPEG",
    bytes: file.size,
    hash,
    origWidth: bmp.width,
    origHeight: bmp.height,
    scale,
    canvas,
    rgba: ctx.getImageData(0, 0, canvas.width, canvas.height),
  };
}

export function grayToDataURL(g: Gray): string {
  const c = document.createElement("canvas");
  c.width = g.w;
  c.height = g.h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(g.w, g.h);
  for (let i = 0; i < g.data.length; i++) {
    const v = g.data[i];
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

export function annotate(src: HTMLCanvasElement, regions: Region[], maxSide = 0): string {
  const s = maxSide ? Math.min(1, maxSide / Math.max(src.width, src.height)) : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const lw = Math.max(2, Math.round(Math.max(c.width, c.height) / 400));
  ctx.lineWidth = lw;
  ctx.font = `${lw * 6}px monospace`;
  for (const r of regions) {
    ctx.strokeStyle = "#f5b301";
    ctx.strokeRect(r.x * s, r.y * s, r.width * s, r.height * s);
    ctx.fillStyle = "#f5b301";
    ctx.fillText(`#${r.id}`, r.x * s, Math.max(lw * 6, r.y * s - lw));
  }
  return c.toDataURL("image/jpeg", 0.85);
}

export function thumb(src: HTMLCanvasElement, maxSide = 480): string {
  return annotate(src, [], maxSide);
}

export function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
