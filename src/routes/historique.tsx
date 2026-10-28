import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DECISIONS, loadControls, toCSV, type Control } from "@/lib/store";
import { download } from "@/lib/imageio";
import { exportPDF } from "@/lib/report";

export const Route = createFileRoute("/historique")({
  head: () => ({
    meta: [
      { title: "Historique — InspectVision" },
      { name: "description", content: "Historique traçable des contrôles visuels et exports CSV/PDF." },
      { property: "og:title", content: "Historique — InspectVision" },
      { property: "og:description", content: "Contrôles enregistrés, filtres et exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

function History() {
  const [all, setAll] = useState<Control[]>([]);
  const [q, setQ] = useState("");
  const [dec, setDec] = useState<string>("");
  const [date, setDate] = useState("");
  const [sel, setSel] = useState<Control | null>(null);
  useEffect(() => setAll(loadControls().reverse()), []);

  const list = useMemo(
    () => all.filter((c) => c.reference.toLowerCase().includes(q.toLowerCase()) && (!dec || c.decision === dec) && (!date || c.createdAt.startsWith(date))),
    [all, q, dec, date],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="label-mono">Module F</p><h1 className="mt-1 text-3xl font-semibold">Historique des contrôles</h1></div>
        <Button variant="secondary" disabled={!list.length} onClick={() => download("inspectvision_controles.csv", toCSV(list), "text/csv;charset=utf-8")}>Exporter CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="w-56" placeholder="Référence…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input className="w-44" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {["", ...DECISIONS].map((d) => (
          <Button key={d} size="sm" variant={dec === d ? "default" : "secondary"} onClick={() => setDec(d)}>{d || "Toutes"}</Button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="overflow-auto rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="label-mono"><tr className="text-left"><th className="p-3">ID</th><th>Date UTC</th><th>Référence</th><th>Image</th><th>Zones</th><th>Décision</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} onClick={() => setSel(c)} className={`cursor-pointer border-t border-border hover:bg-accent ${sel?.id === c.id ? "bg-accent" : ""}`}>
                  <td className="p-3 font-mono text-primary">{c.id}</td>
                  <td className="font-mono text-xs">{c.createdAt.replace("T", " ").slice(0, 19)}</td>
                  <td>{c.reference}</td>
                  <td className="max-w-40 truncate text-muted-foreground">{c.imageName}</td>
                  <td className="font-mono">{c.regions.length}</td>
                  <td><DecisionTag d={c.decision} /></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun contrôle.</td></tr>}
            </tbody>
          </table>
        </div>
        {sel && (
          <aside className="space-y-3 rounded-sm border border-border bg-card p-4 text-sm">
            <div className="flex items-center justify-between"><p className="label-mono">Contrôle {sel.id}</p><Button size="sm" onClick={() => exportPDF(sel)}>PDF</Button></div>
            <div className="grid grid-cols-2 gap-2"><img src={sel.originalThumb} alt="Original" /><img src={sel.annotatedThumb} alt="Annotée" /></div>
            <p><DecisionTag d={sel.decision} /> · {sel.regions.length} zone(s)</p>
            <p className="text-muted-foreground">{sel.comment || "Sans observation"}</p>
            <pre className="overflow-auto rounded-sm bg-muted p-2 font-mono text-[10px] text-muted-foreground">{JSON.stringify({ sha256: sel.imageHash, version: sel.appVersion, params: sel.params }, null, 1)}</pre>
          </aside>
        )}
      </div>
    </div>
  );
}

function DecisionTag({ d }: { d: string }) {
  const cls = d === "Conforme" ? "border-success text-success" : d === "Non conforme" ? "border-destructive text-destructive" : "border-primary text-primary";
  return <span className={`rounded-sm border px-2 py-0.5 font-mono text-xs ${cls}`}>{d}</span>;
}
