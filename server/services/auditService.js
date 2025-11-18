// backend/src/services/auditService.js
const fs = require('fs').promises;
const path = require('path');

const LOG_FILE_PATH = path.join(__dirname, '../../logs/audit.json');

async function logScreeningEvent(inputName, userId, ipAddress, result) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    inputName,
    userId,
    ipAddress,
    result,
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

module.exports = { logScreeningEvent };
