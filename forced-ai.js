const fs = require('fs');
const path = require('path');

const DEFAULT_FORCED_AI_FILE = path.join(__dirname, 'config', 'forced-ai.txt');
const forcedFile = process.env.FORCED_AI_FILE
  ? path.resolve(process.env.FORCED_AI_FILE)
  : DEFAULT_FORCED_AI_FILE;

let forcedCodes = new Set();

function normalize(code) {
  if (!code) {
    return null;
  }
  const normalized = String(code).replace(/\s/g, '').toUpperCase();
  return /^[0-9]{10}$/.test(normalized) ? normalized : null;
}

function loadForcedCodes() {
  try {
    const raw = fs.readFileSync(forcedFile, 'utf8');
    const lines = raw.split(/\r?\n/);
    forcedCodes = new Set(
      lines
        .map((line) => line.split('#')[0].trim())
        .filter(Boolean)
        .map(normalize)
        .filter(Boolean)
    );
    console.log(`✓ Loaded ${forcedCodes.size} forced AI UCAS codes (${forcedFile})`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      forcedCodes = new Set();
      console.log(`ℹ️ No forced AI list found at ${forcedFile} (skipping)`);
    } else {
      forcedCodes = new Set();
      console.error('Error reading forced AI list:', error.message);
    }
  }
}

function isForcedAi(code) {
  const normalized = normalize(code);
  if (!normalized) {
    return false;
  }
  return forcedCodes.has(normalized);
}

function forcedAiCount() {
  return forcedCodes.size;
}

loadForcedCodes();

module.exports = {
  isForcedAi,
  forcedAiCount,
  forcedAiFile: forcedFile,
  reloadForcedAi: loadForcedCodes,
};
