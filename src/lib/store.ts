import type { Params, Region } from "./vision";

export const APP_VERSION = "2.0.0-web";
export type Decision = "Conforme" | "Non conforme" | "À vérifier";
export const DECISIONS: Decision[] = ["Conforme", "Non conforme", "À vérifier"];

export interface Control {
  id: string;
  createdAt: string; // ISO 8601 UTC
  appVersion: string;
  reference: string;
  imageName: string;
  imageHash: string;
  imageWidth: number;
  imageHeight: number;
  params: Params;
  threshold: number;
  regions: Region[];
  decision: Decision;
  comment: string;
  correctsId: string | null;
  originalThumb: string;
  annotatedThumb: string;
}

const KEY = "inspectvision.controls.v1";

export function validateControl(c: Pick<Control, "reference" | "decision">): string | null {
  if (!c.reference.trim()) return "La référence du matériau est obligatoire.";
  if (!DECISIONS.includes(c.decision)) return "Choisissez une décision.";
  return null;
}

export function loadControls(): Control[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Append-only: existing controls are never modified. */
export function saveControl(c: Control): void {
  const all = loadControls();
  all.push(c);
  localStorage.setItem(KEY, JSON.stringify(all));
}

const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function toCSV(list: Control[]): string {
  const head = ["id", "date_utc", "reference", "image", "nb_zones", "decision", "commentaire"];
  const rows = list.map((c) =>
    [c.id, c.createdAt, c.reference, c.imageName, c.regions.length, c.decision, c.comment].map(esc).join(","),
  );
  return [head.join(","), ...rows].join("\n");
}
