import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AiExplain({ getImage, zones, defaultMaterial }: { getImage: () => string; zones?: string; defaultMaterial?: string }) {
  const [material, setMaterial] = useState(defaultMaterial ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  async function run() {
    if (!material.trim()) { setError("Indiquez le matériau inspecté."); return; }
    setError(null); setText(""); setBusy(true);
    ctrl.current = new AbortController();
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: getImage(), material, zones }),
        signal: ctrl.current.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "L'analyse IA a échoué.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-sm border border-border bg-card p-5">
      <p className="label-mono">D · Explication par IA</p>
      <p className="text-xs text-muted-foreground">La photo est envoyée au service IA (hors traitement local). Le résultat est une aide, pas une certification.</p>
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="flex-1 space-y-2"><Label>Matériau inspecté</Label><Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="ex. tôle acier galvanisé, bois de chêne, PVC…" /></div>
        {busy
          ? <Button variant="secondary" onClick={() => ctrl.current?.abort()}>Arrêter</Button>
          : <Button onClick={run}>Expliquer les défauts</Button>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {busy && !text && <p className="text-sm text-muted-foreground">Analyse en cours…</p>}
      {text && <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>}
    </div>
  );
}
