import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const destination = new URL('./dist/', import.meta.url);
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
for (const name of ['index.html', 'admin.html', 'style.css', 'redesign.css', 'script.js', 'redesign.js', 'admin.js', 'site-defaults.js', 'site-content.js', 'content-editor.js', 'content.css', 'img']) {
  cpSync(new URL(name, import.meta.url), new URL(name, destination), { recursive: true });
}
console.log('Static website prepared in ' + fileURLToPath(destination));
