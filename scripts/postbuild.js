const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, '.next', 'standalone');

// Load .env.local manually since Node.js does not auto-load it
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  Skipping ${src} (not found)`);
    return;
  }
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`  ✅ Copied ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  Skipping ${src} (not found)`);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log(`  ✅ Copied ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
}

console.log('\n🔧 Running OpenTalib post-build setup...\n');

// 1. Copy static assets
copyDir(path.join(ROOT, '.next', 'static'), path.join(STANDALONE, '.next', 'static'));

// 2. Copy public folder
copyDir(path.join(ROOT, 'public'), path.join(STANDALONE, 'public'));

// 3. Copy .env.local to standalone
copyFile(path.join(ROOT, '.env.local'), path.join(STANDALONE, '.env.local'));

// 4. Create media storage directory
const mediaPath = process.env.MEDIA_STORAGE_PATH;
if (mediaPath) {
  const classroomsPath = path.join(mediaPath, 'classrooms');
  fs.mkdirSync(classroomsPath, { recursive: true });
  console.log(`  ✅ Media directory ready: ${classroomsPath}`);
} else {
  const localData = path.join(STANDALONE, 'data', 'classrooms');
  fs.mkdirSync(localData, { recursive: true });
  console.log(`  ✅ Local media directory ready: ${localData}`);
}

console.log('\n✅ Post-build setup complete!\n');
