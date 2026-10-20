import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';

console.log('Building Vite client bundle...');
await viteBuild();

console.log('Bundling server API for Vercel/Node...');
await esbuild.build({
  entryPoints: ['server/apiApp.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: 'api/index.js'
});

console.log('Build completed successfully!');
