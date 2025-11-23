const { v4: uuidv4 } = require('uuid');

/**
 * PRODUCTION SAFETY:
 * Masks PII (Personally Identifiable Information) in log streams.
 * Input: "Aishah Ahmed Mohamed" -> Output: "Aishah *****"
 */
const maskPII = (text) => {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);
  
  const words = text.trim().split(/\s+/);
  // If it's just one word, log it. If multiple, mask all but the first.
  if (words.length <= 1) return text; 
  return `${words[0]} ${'*'.repeat(5)}`;
};

/**
 * Standardizes log format for ingestion tools (Datadog, Splunk, CloudWatch)
 */
const formatLog = (level, message, meta = {}) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  });
};

const logger = {
  info: (message, meta) => console.log(formatLog('INFO', message, meta)),
  
  warn: (message, meta) => console.warn(formatLog('WARN', message, meta)),
  
  // securely logs errors including stack traces
  error: (message, error, meta = {}) => {
    console.error(formatLog('ERROR', message, {
      ...meta,
      error: error?.message || error,
      stack: error?.stack
    }));
  },

  // Specialized audit log for compliance
  audit: (action, subjectName, status, meta = {}) => {
    console.log(formatLog('AUDIT', `Action: ${action}`, {
      ...meta,
      action,
      subject: maskPII(subjectName), // PII PROTECTION APPLIED
      status
    }));
  }
};

module.exports = { logger, maskPII };