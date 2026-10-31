<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Pixel analysis runs in the browser (src/lib/vision.ts, pure, tested); controls are stored append-only in localStorage. Only the opt-in "Explication par IA" panel sends a photo to the AI Gateway via the /api/explain server route — keep any other processing local.
- Factory materials (name, description, AI hints, detection params) live in the public.materials table, read-only from the app; selecting one applies its params and sends its hints to /api/explain.
