// server/services/dataVersioningService.js
const fs = require('fs').promises;
const path = require('path');

const VERSION_FILE_PATH = path.join(__dirname, '../data/data_version.json');

/**
 * Retrieves the current data source version information.
 * @returns {Promise<object>} A promise that resolves to the version data.
 */
async function getDataVersions() {
  try {
    const data = await fs.readFile(VERSION_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data version file:', error);
    return { error: 'Could not retrieve data version information.' };
  }
}

/**
 * Updates the version information for a specific list.
 * @param {string} listName - The name of the list (e.g., "UN_Sanctions_List").
 * @param {object} newInfo - The new information to merge (e.g., { last_updated: "...", version: "..." }).
 */
async function updateDataVersion(listName, newInfo) {
  try {
    const versions = await getDataVersions();
    if (versions[listName]) {
      versions[listName] = { ...versions[listName], ...newInfo };
      await fs.writeFile(VERSION_FILE_PATH, JSON.stringify(versions, null, 2));
      console.log(`Data version updated for: ${listName}`);
    } else {
      console.warn(`Attempted to update non-existent list: ${listName}`);
    }
  } catch (error) {
    console.error('Failed to update data version:', error);
  }
}

module.exports = { getDataVersions, updateDataVersion };
