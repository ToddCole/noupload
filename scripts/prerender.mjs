import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROUTES = {
  '/': 'index.html',
  '/compress': 'compress/index.html',
  '/share-safe': 'share-safe/index.html',
  '/meta-stripper': 'meta-stripper/index.html',
  '/redact': 'redact/index.html',
  '/remove-gps-from-photo': 'remove-gps-from-photo/index.html',
};

const { render } = await import('../dist-ssr/entry-server.js');

for (const [route, file] of Object.entries(ROUTES)) {
  const html = render(route);
  const filePath = path.resolve('dist', file);
  const template = await readFile(filePath, 'utf-8');

  if (!template.includes('<div id="root"></div>')) {
    throw new Error(`Could not find empty root div in ${file} — prerender marker missing or already applied.`);
  }

  const output = template.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  await writeFile(filePath, output);
  console.log(`Prerendered ${route} -> dist/${file}`);
}
