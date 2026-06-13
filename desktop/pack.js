// ---------------------------------------------------------------------------
// Build an unpacked Windows desktop app with @electron/packager.
// Produces:  dist-desktop/Gmail Scheduler-win32-x64/Gmail Scheduler.exe
//
// No installer, no code-signing tooling, no admin rights required - just a
// folder the team can copy and run. Run via:  npm run desktop:pack
// ---------------------------------------------------------------------------

const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Paths (relative to project root, leading slash) that must NOT be bundled.
// IMPORTANT: profiles/ holds live Gmail session cookies - never ship it.
const IGNORE = [
  /^\/dist-desktop/,
  /^\/\.git($|\/)/,
  /^\/\.claude($|\/)/,
  /^\/profiles($|\/)/,        // Gmail sessions - privacy
  /^\/screenshots($|\/)/,
  /^\/logs($|\/)/,
  /^\/data\/uploads($|\/)/,
  /^\/data\/backups($|\/)/,
  /^\/dashboard\/frontend\/node_modules($|\/)/,
  /^\/dashboard\/frontend\/src($|\/)/,
  /^\/dashboard\/frontend\/\.vite($|\/)/,
  /\.map$/,
  /^\/prompt\.md$/,
  /^\/\.geminiignore$/,
];

async function main() {
  console.log('Packaging Gmail Scheduler desktop app …');
  const { packager } = await import('@electron/packager'); // ESM-only module
  const appPaths = await packager({
    dir: ROOT,
    name: 'Gmail Scheduler',
    platform: 'win32',
    arch: 'x64',
    out: path.join(ROOT, 'dist-desktop'),
    overwrite: true,
    prune: true,                 // drop devDependencies (electron, builder, …)
    asar: true,                  // bundle app source into app.asar
    ignore: IGNORE,
    appVersion: require('../package.json').version,
    appCopyright: 'GetRedditor',
  });
  console.log('\nDone. App folder:');
  appPaths.forEach(p => console.log('  ' + p));
  console.log('\nShare the whole folder. The team runs "Gmail Scheduler.exe" inside it.');
}

main().catch(err => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
