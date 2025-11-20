// backend/utils/nameNormalizer.js

const phonetic = require('phonetic');

/**
 * Normalizes a name string for better matching.
 * - Converts to lowercase
 * - Removes punctuation
 * - Removes common titles and particles
 * - Removes extra whitespace
 * @param {string} name The name to normalize.
 * @returns {string} The normalized name.
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
    .replace(/\b(al|bin|de|del|der|di|la|le|van|von|the|mr|mrs|ms|dr|jr|sr|iii|ii|iv)\b/g, '') // Remove common particles/titles
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Generates the Soundex code for a name.
 * @param {string} name The name to process.
 * @returns {string} The Soundex code.
 */
function getSoundex(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  // The 'phonetic' library's soundex function is simple and sufficient for this purpose.
  return phonetic.soundex(name);
}

/**
 * Generates the Metaphone code for a name.
 * @param {string} name The name to process.
 * @returns {string} The Metaphone code.
 */
function getMetaphone(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  // The 'phonetic' library's metaphone function is simple and sufficient for this purpose.
  return phonetic.metaphone(name);
}

module.exports = { normalizeName, getSoundex, getMetaphone };
