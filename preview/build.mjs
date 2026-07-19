/* Builds the self-contained preview HTML (for the claude.ai artifact).
   Usage: node preview/build.mjs [outfile] */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(repo, p), 'utf8');

const html = `<title>Blitz Leaderboard 95 🎾</title>
<style>
${read('public/css/win95.css')}
${read('public/css/theme.css')}
</style>
<main class="desktop">
  <div id="page-root"></div>
</main>
<script>
${read('preview/mock-api.js')}
${read('public/js/chaos.js')}
${read('public/js/leaderboard.js')}
${read('public/js/sessions.js')}
${read('public/js/admin.js')}
${read('preview/preview.js')}
</script>
`;

const out = process.argv[2] || join(repo, 'preview', 'blitz-preview.html');
writeFileSync(out, html);
console.log('wrote', out, html.length, 'bytes');
