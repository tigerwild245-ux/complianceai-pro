// server/services/falsePositiveService.js
const fs = require('fs').promises;
const path = require('path');
const { normalizeName } = require('../utils/nameNormalizer');

const FALSE_POSITIVES_PATH = path.join(__dirname, '../../data/falsePositives.json');

async function getFalsePositives() {
  try {
    const data = await fs.readFile(FALSE_POSITIVES_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading false positives file:', error);
    return [];
  }
}

async function isFalsePositive(name) {
  const falsePositives = await getFalsePositives();
  const normalizedName = normalizeName(name);
  return falsePositives.some(fp => normalizeName(fp.name) === normalizedName);
}

async function addFalsePositive(name) {
  const falsePositives = await getFalsePositives();
  const normalizedName = normalizeName(name);
  if (falsePositives.some(fp => normalizeName(fp.name) === normalizedName)) {
    return { success: false, message: 'This name is already on the false positive list.' };
  }
  falsePositives.push({ name, addedOn: new Date().toISOString() });
  await fs.writeFile(FALSE_POSITIVES_PATH, JSON.stringify(falsePositives, null, 2));
  return { success: true, message: 'Successfully added to false positive list.' };
}

module.exports = { getFalsePositives, isFalsePositive, addFalsePositive };
