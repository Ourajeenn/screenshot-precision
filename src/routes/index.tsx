import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { analyze, DEFAULT_PARAMS, toGray, type Params, type Region } from "@/lib/vision";
import { annotate, grayToDataURL, loadImage, thumb, type LoadedImage } from "@/lib/imageio";
import { APP_VERSION, DECISIONS, saveControl, validateControl, type Decision } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inspection — InspectVision" },
      { name: "description", content: "Importer une image de matériau, repérer les zones suspectes et documenter la décision de l'opérateur." },
      { property: "og:title", content: "Inspection — InspectVision" },
      { property: "og:description", content: "Aide au contrôle visuel de matériaux, traitement 100 % local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inspection,
});

interface Result {
  regions: Region[];
  threshold: number;
  ms: number;
  pre: string;
  annotated: string;
  params: Params;
}

function Inspection() {
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [result, setResult] = useState<Result | null>(null);
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const set = <K extends keyof Params>(k: K, v: Params[K]) => setParams((p) => ({ ...p, [k]: v }));

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null); setResult(null); setImg(null); setDecision(null);
    try {
      setImg(await loadImage(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fichier illisible.");
    }
  }

  function run() {
    if (!img) return;
    try {
      const g = toGray(img.rgba.data, img.rgba.width, img.rgba.height);
      const r = analyze(g, params);
      setResult({ ...r, pre: grayToDataURL(r.pre), annotated: annotate(img.canvas, r.regions), params: { ...params } });
    } catch {
      setError("L'analyse a échoué sur cette image.");
    }
  }

  function save() {
    if (!img || !result) return;
    const err = validateControl({ reference, decision: decision as Decision });
    if (err || !decision) return toast.error(err ?? "Choisissez une décision.");
    const id = crypto.randomUUID().slice(0, 8);
    saveControl({
      id,
      createdAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      reference: reference.trim(),
      imageName: img.name,
      imageHash: img.hash,
      imageWidth: img.canvas.width,
      imageHeight: img.canvas.height,
      params: result.params,
      threshold: result.threshold,
      regions: result.regions,
      decision,
      comment: comment.trim(),
      correctsId: null,
      originalThumb: thumb(img.canvas),
      annotatedThumb: annotate(img.canvas, result.regions, 480),
    });
    toast.success(`Contrôle ${id} enregistré`);
    setDecision(null); setComment("");
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-mono">Poste d'inspection</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Contrôle visuel assisté</h1>
        </div>
        <p className="max-w-xl rounded-sm border border-primary/40 bg-primary/10 px-4 py-2 text-xs text-foreground">
          Prototype non certifié. Les zones encadrées sont des régions visuellement inhabituelles, pas des défauts avérés. La décision appartient à l'opérateur.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-5 rounded-sm border border-border bg-card p-5">
          <div className="space-y-2">
            <p className="label-mono">A · Image</p>
            <Input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => onFile(e.target.files?.[0])} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {img && (
              <dl className="grid grid-cols-2 gap-x-2 font-mono text-xs text-muted-foreground">
                <dt>Format</dt><dd>{img.type}</dd>
                <dt>Taille</dt><dd>{img.origWidth}×{img.origHeight}</dd>
                <dt>Analyse</dt><dd>{img.canvas.width}×{img.canvas.height}{img.scale < 1 && " (réduite)"}</dd>
                <dt>SHA-256</dt><dd className="truncate" title={img.hash}>{img.hash.slice(0, 16)}…</dd>
              </dl>
            )}
          </div>

          <div className="space-y-4">
            <p className="label-mono">B · Prétraitement</p>
            <Num label="Flou (rayon)" v={params.blurRadius} min={0} max={8} on={(v) => set("blurRadius", v)} />
            <Toggle label="Correction d'éclairage" v={params.illumination} on={(v) => set("illumination", v)} />
            {params.illumination && <Num label="Rayon du fond" v={params.illumRadius} min={10} max={120} on={(v) => set("illumRadius", v)} />}
            <Toggle label="Égalisation du contraste" v={params.contrast} on={(v) => set("contrast", v)} />
          </div>

          <div className="space-y-4">
            <p className="label-mono">C · Détection</p>
            <div className="grid grid-cols-2 gap-1">
              {(["sigma", "otsu"] as const).map((m) => (
                <Button key={m} size="sm" variant={params.method === m ? "default" : "secondary"} onClick={() => set("method", m)}>
                  {m === "sigma" ? "Écart k·σ" : "Otsu"}
                </Button>
              ))}
            </div>
            {params.method === "sigma" && <Num label="k (écarts-types)" v={params.sigmaK} min={1} max={5} step={0.1} on={(v) => set("sigmaK", v)} />}
            <Toggle label="Ouverture morphologique" v={params.opening} on={(v) => set("opening", v)} />
            <Num label="Surface min. (px)" v={params.minArea} min={5} max={2000} step={5} on={(v) => set("minArea", v)} />
          </div>

          <Button className="w-full" disabled={!img} onClick={run}>Analyser</Button>
        </aside>

        <section className="space-y-6">
          {!img && (
            <div className="grid h-80 place-items-center rounded-sm border border-dashed border-border text-sm text-muted-foreground">
              Importez une image JPG ou PNG pour commencer.
            </div>
          )}
          {img && (
            <div className="grid gap-4 md:grid-cols-2">
              <Figure label="Original" src={img.canvas.toDataURL("image/jpeg", 0.85)} />
              <Figure label={result ? `Annotée · ${result.regions.length} zone(s)` : "Annotée"} src={result?.annotated} />
              {result && <Figure label="Prétraitée" src={result.pre} />}
              {result && (
                <div className="rounded-sm border border-border bg-card p-4">
                  <p className="label-mono">Mesures</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    seuil {Number.isFinite(result.threshold) ? result.threshold.toFixed(1) : "—"} · {result.ms.toFixed(0)} ms
                  </p>
                  <div className="mt-3 max-h-64 overflow-auto">
                    <table className="w-full font-mono text-xs">
                      <thead className="text-muted-foreground"><tr><th className="text-left">#</th><th>x</th><th>y</th><th>l</th><th>h</th><th className="text-right">px²</th></tr></thead>
                      <tbody>
                        {result.regions.map((r) => (
                          <tr key={r.id} className="border-t border-border text-center"><td className="text-left text-primary">{r.id}</td><td>{r.x}</td><td>{r.y}</td><td>{r.width}</td><td>{r.height}</td><td className="text-right">{r.area}</td></tr>
                        ))}
                        {!result.regions.length && <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">Aucune zone suspecte détectée</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-sm border border-border bg-card p-5">
              <p className="label-mono">E · Décision de l'opérateur</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Référence du matériau</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ex. LOT-2026-114" /></div>
                <div className="space-y-2">
                  <Label>Décision</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {DECISIONS.map((d) => (
                      <Button key={d} size="sm" variant={decision === d ? "default" : "secondary"} onClick={() => setDecision(d)}>{d}</Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2"><Label>Observations</Label><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></div>
              <Button onClick={save}>Enregistrer le contrôle</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Figure({ label, src }: { label: string; src?: string }) {
  return (
    <figure className="overflow-hidden rounded-sm border border-border bg-card">
      <figcaption className="label-mono border-b border-border px-3 py-2">{label}</figcaption>
      {src ? <img src={src} alt={label} className="w-full" /> : <div className="grid h-48 place-items-center text-xs text-muted-foreground">Lancez l'analyse</div>}
    </figure>
  );
}

function Num({ label, v, min, max, step = 1, on }: { label: string; v: number; min: number; max: number; step?: number; on: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="font-mono text-primary">{v}</span></div>
      <Slider value={[v]} min={min} max={max} step={step} onValueChange={([x]) => on(x)} />
    </div>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">{label}<Switch checked={v} onCheckedChange={on} /></label>
  );
}
