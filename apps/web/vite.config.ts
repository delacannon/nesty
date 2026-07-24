import { defineConfig } from 'vite';

// Landing site. Builds to apps/web/dist. The editor build (apps/editor)
// writes into apps/web/dist/editor, so `pnpm build` at the root yields one
// static folder: / = landing, /editor/ = editor.
// Root `build` MUST run this before the editor build: the site clears dist,
// then the editor writes into dist/editor.
export default defineConfig({});
