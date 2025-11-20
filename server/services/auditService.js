// backend/src/services/auditService.js
const fs = require('fs').promises;
const path = require('path');

const LOG_FILE_PATH = path.join(__dirname, '../../logs/audit.json');

/**
 * Logs a screening event with full details for audit trail.
 * @param {string} inputName - The name screened.
 * @param {string} userId - The user who initiated the screen.
 * @param {string} ipAddress - The IP address of the request.
 * @param {object} result - The full result object from screeningService.
 */
async function logScreeningEvent(inputName, userId, ipAddress, result) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    inputName,
    userId,
    ipAddress,
    riskScore: result.riskScore, // Include the final risk score for quick review
    matchesCount: result.matches ? result.matches.length : 0,
    resultSummary: result.analysis,
    fullResult: result, // Store the full result for Match Transparency & Reasoning
  };

  try {
    // Read existing logs
    let logs = [];
    try {
      const data = await fs.readFile(LOG_FILE_PATH, 'utf8');
      logs = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or is empty, that's fine. We'll start a new log.
      if (error.code !== 'ENOENT') {
        console.error('Error reading audit log:', error);
      }
    }

    // Add new entry
    logs.push(logEntry);

    // Write back to file
    await fs.writeFile(LOG_FILE_PATH, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Failed to write to audit log:', error);
  }
}

/**
 * Retrieves all audit logs.
 * @returns {Promise<Array>} A promise that resolves to an array of audit log entries.
 */
async function getAuditLogs() {
  try {
    const data = await fs.readFile(LOG_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // Return empty array if file doesn't exist
    }
    console.error('Error retrieving audit logs:', error);
    throw new Error('Could not retrieve audit logs.');
  }
}

module.exports = { logScreeningEvent, getAuditLogs };
