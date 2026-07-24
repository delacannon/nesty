# @nesty/web

The NESty marketing site — landing page plus the `/editor` route.

## Dev

The site and the editor are separate Vite apps in dev:

```sh
pnpm --filter @nesty/web dev      # landing at http://localhost:5174
pnpm --filter @nesty/editor dev   # editor  at http://localhost:5173
```

"Open the Editor" links point at `http://localhost:5173/` in dev (see
`src/main.ts`) and at `/editor/` in the production build.

## Build

From the repo root:

```sh
pnpm build
```

This builds the site into `apps/web/dist`, then builds the editor into
`apps/web/dist/editor` (see `apps/editor/vite.config.ts` `base` + `outDir`).
The result is one static folder:

```
apps/web/dist/
  index.html          ->  /          (landing)
  editor/index.html   ->  /editor/    (full editor)
  editor/play.html    ->  /editor/play.html
```

Serve it with any static host — no rewrites needed, `/editor/` is a real folder.

## Design

Styling comes from `@nesty/ui` (shared tokens + base components, salmon `pc98`
theme) plus `src/site.css` for the landing layout.
