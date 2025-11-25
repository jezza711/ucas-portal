const fs = require('fs');
const path = require('path');

const DEFAULT_PACKS_DIR = path.join(__dirname, 'uploads', 'packs');
const PACKS_DIR = process.env.PACKS_DIR
  ? path.resolve(process.env.PACKS_DIR)
  : DEFAULT_PACKS_DIR;

const PACK_FILENAMES = {
  VIDEO: 'video-pack.pdf',
  AI: 'ai-pack.pdf',
};

function ensurePacksDir() {
  if (!fs.existsSync(PACKS_DIR)) {
    fs.mkdirSync(PACKS_DIR, { recursive: true });
  }
}

ensurePacksDir();

function normalizeBaseUrl() {
  const base = process.env.PUBLIC_BASE_URL || '';
  if (!base) {
    return null;
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function getLocalFilePath(group) {
  const filename = PACK_FILENAMES[group];
  if (!filename) {
    return null;
  }
  return path.join(PACKS_DIR, filename);
}

function hasLocalFile(group) {
  const filePath = getLocalFilePath(group);
  return filePath ? fs.existsSync(filePath) : false;
}

function getRelativePath(group) {
  if (!hasLocalFile(group)) {
    return null;
  }
  return `/packs/${PACK_FILENAMES[group]}`;
}

function getPackLinks(group) {
  const relativePath = getRelativePath(group);
  if (!relativePath) {
    return { client: null, email: null };
  }

  const base = normalizeBaseUrl();
  const absolute = base ? `${base}${relativePath}` : relativePath;

  return { client: relativePath, email: absolute };
}

function savePack(group, buffer) {
  if (!PACK_FILENAMES[group]) {
    throw new Error('Unsupported group for pack upload');
  }
  if (!buffer) {
    throw new Error('Missing PDF buffer');
  }

  const filePath = getLocalFilePath(group);
  fs.writeFileSync(filePath, buffer);
  return getPackLinks(group);
}

module.exports = {
  PACKS_DIR,
  getPackLinks,
  savePack,
};
