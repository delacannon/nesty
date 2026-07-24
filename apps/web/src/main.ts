import '@nesty/ui/index.css';
import './site.css';

// Editor lives at /editor/ in the combined production build. In dev the editor
// runs on its own Vite server, so point the CTAs there instead.
const EDITOR_URL = import.meta.env.DEV ? 'http://localhost:5173/' : '/editor/';
document.querySelectorAll<HTMLAnchorElement>('[data-editor-link]').forEach((a) => {
  a.href = EDITOR_URL;
});

// Repo link (kept in sync in one place).
const REPO_URL = 'https://github.com/delacannon/nesty';
document.querySelectorAll<HTMLAnchorElement>('[data-repo]').forEach((a) => {
  a.href = REPO_URL;
});

// Smooth in-page scrolling for the nav anchors.
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
