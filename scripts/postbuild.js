const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, '.next', 'standalone');

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
copyDir(
  path.join(ROOT, '.next', 'static'),
  path.join(STANDALONE, '.next', 'static')
);

// 2. Copy public folder
copyDir(
  path.join(ROOT, 'public'),
  path.join(STANDALONE, 'public')
);

// 3. Copy .env.local to standalone
copyFile(
  path.join(ROOT, '.env.local'),
  path.join(STANDALONE, '.env.local')
);

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
