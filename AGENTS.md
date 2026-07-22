# Commits

- Keep commit messages concise: a short subject line; add a body only when it explains something the diff can't.
- Never add `Co-Authored-By` or any other AI-attribution trailers.

# Project rules

- This package must stay host-neutral: no references to consuming apps or company internals in source, comments, or dist. Host integration goes through props/runtime only (see README).
- Markdown serialization is a stability contract — run `pnpm test` (golden round-trip corpus) after touching any serializer, extension order, or the Markdown extension config. Regenerate fixtures only intentionally: `UPDATE_FIXTURES=1 npx vitest run`.
- Heavy deps (katex, lowlight, mermaid, recharts) may only be imported from their feature modules — that's what keeps them out of hosts' bundles when flags are off.
- Never declare `light-dark()` inside the `:root` theme tokens: Lightning CSS (the default CSS processor under Next.js/Turbopack hosts) polyfills it into flag variables that only exist inside `color-scheme` scopes, which silently turns every token transparent at `:root`. Light palette plain on `:root`, dark palette re-declared under `[data-rdump-color-scheme]` — see the header of `src/styles/theme.css`. Use-site `light-dark()` inside the wrapper subtree (e.g. code chip fills) is fine.
