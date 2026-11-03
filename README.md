# Screenshot Precision

Prototype de contrôle visuel assisté pour l'inspection de matériaux. L'application analyse une image, signale des zones visuellement inhabituelles et permet à l'opérateur de documenter sa décision.

## Fonctionnalités

- Import d'images JPG/PNG ou capture depuis la caméra.
- Prétraitement et détection paramétrable des zones suspectes.
- Visualisation des résultats annotés et de leurs mesures.
- Aide à l'interprétation par IA et historique des contrôles.
- Enregistrement d'une référence, d'une décision opérateur et d'observations.

Les zones détectées sont des anomalies visuelles possibles, pas des défauts certifiés. La décision appartient à l'opérateur.

## Stack

React 19, TypeScript, TanStack Start, Vite, Supabase et Drizzle.

## Development

Pré-requis : Node.js et Bun.

```sh
bun install
bun run dev
```

Tests : `bun run test`.
