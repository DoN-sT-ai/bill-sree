import { execSync } from 'child_process';

console.log('Building Vite client bundle...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('Bundling server API for Vercel/Node...');
execSync('npx esbuild server/apiApp.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js', { stdio: 'inherit' });

console.log('Build completed successfully!');
