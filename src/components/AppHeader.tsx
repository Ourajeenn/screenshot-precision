import { Link } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Inspection" },
  { to: "/historique", label: "Historique" },
  { to: "/evaluation", label: "Évaluation" },
] as const;

export function AppHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-sm border border-primary font-mono text-sm text-primary">IV</span>
          <span className="font-mono text-sm font-semibold tracking-widest">INSPECTVISION</span>
          <span className="label-mono hidden sm:inline">prototype v2.0</span>
        </Link>
        <nav className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-sm px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-primary" }}
              activeOptions={{ exact: true }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
