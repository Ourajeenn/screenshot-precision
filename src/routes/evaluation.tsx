import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyze, DEFAULT_PARAMS, evaluate, type Box, type Gray } from "@/lib/vision";

export const Route = createFileRoute("/evaluation")({
  head: () => ({
    meta: [
      { title: "Évaluation — InspectVision" },
      { name: "description", content: "Mesure de la détection : IoU, précision, rappel sur un jeu annoté." },
      { property: "og:title", content: "Évaluation — InspectVision" },
      { property: "og:description", content: "Mesurer avant d'affirmer : précision et rappel de la détection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Evaluation,
});

// Seeded PRNG so the synthetic set is identical on every run.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function synthSet(n: number) {
  const r = rng(42);
  return Array.from({ length: n }, (_, k) => {
    const w = 256, h = 256, data = new Float32Array(w * h);
    const grad = k % 3 === 0 ? 60 : 0; // uneven lighting on 1/3
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = 150 + (grad * x) / w + (r() - 0.5) * 30;
    const truth: Box[] = [];
    const count = k % 4; // 0..3 spots, includes clean surfaces
    for (let i = 0; i < count; i++) {
      const s = 8 + Math.floor(r() * 20), x0 = Math.floor(r() * (w - s)), y0 = Math.floor(r() * (h - s));
      truth.push({ x: x0, y: y0, width: s, height: s });
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) data[y * w + x] -= 70;
    }
    return { g: { w, h, data } as Gray, truth };
  });
}

type Row = { name: string; tp: number; fp: number; fn: number; precision: number | null; recall: number | null };

function Evaluation() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [json, setJson] = useState(JSON.stringify(DEFAULT_PARAMS, null, 1));
  const [err, setErr] = useState<string | null>(null);

  function run() {
    let params;
    try { params = { ...DEFAULT_PARAMS, ...JSON.parse(json) }; setErr(null); } catch { return setErr("JSON de paramètres invalide."); }
    const set = synthSet(24);
    const variants = [
      { name: "Paramètres saisis", p: params },
      { name: "Otsu sans correction", p: { ...params, method: "otsu", illumination: false } },
      { name: "k·σ sans correction", p: { ...params, method: "sigma", illumination: false } },
    ];
    setRows(variants.map(({ name, p }) => {
      let tp = 0, fp = 0, fn = 0;
      for (const s of set) { const e = evaluate(analyze(s.g, p).regions, s.truth, 0.5); tp += e.tp; fp += e.fp; fn += e.fn; }
      return { name, tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null };
    }));
  }
  const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)} %`);

  return (
    <div className="space-y-6">
      <div><p className="label-mono">Module H</p><h1 className="mt-1 text-3xl font-semibold">Évaluation de la détection</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Jeu de 24 images synthétiques déterministes (bruit, éclairage inégal, surfaces saines). Une détection est correcte si son IoU avec une annotation ≥ 0,5. Ces chiffres valent pour ce jeu synthétique uniquement, pas pour de vrais réfractaires.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3 rounded-sm border border-border bg-card p-4">
          <p className="label-mono">Paramètres (JSON)</p>
          <Textarea rows={12} className="font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="w-full" onClick={run}>Lancer l'évaluation</Button>
        </div>
        <div className="rounded-sm border border-border bg-card">
          <table className="w-full font-mono text-sm">
            <thead className="label-mono"><tr><th className="p-3 text-left">Méthode</th><th>VP</th><th>FP</th><th>FN</th><th>Précision</th><th>Rappel</th></tr></thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.name} className="border-t border-border text-center"><td className="p-3 text-left font-sans">{r.name}</td><td>{r.tp}</td><td>{r.fp}</td><td>{r.fn}</td><td className="text-primary">{pct(r.precision)}</td><td className="text-primary">{pct(r.recall)}</td></tr>
              ))}
              {!rows && <tr><td colSpan={6} className="p-8 text-center font-sans text-muted-foreground">Lancez l'évaluation pour obtenir des chiffres mesurés.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
