import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Dev-only helper: POST a PNG to /__save-shot?name=foo saves it to ../screenshots/foo.png.
function screenshotSaver() {
  return {
    name: 'screenshot-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-shot', (req, res) => {
        const name = new URL(req.url, 'http://x').searchParams.get('name') || 'shot';
        const safe = name.replace(/[^a-z0-9-_]/gi, '_');
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const dir = path.resolve(process.cwd(), '..', 'screenshots');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${safe}.png`), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [screenshotSaver()],
  server: { port: 5183, strictPort: true },
  build: { chunkSizeWarningLimit: 2600 },
});
