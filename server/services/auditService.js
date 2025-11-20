// server/services/auditService.js (Updated for Supabase)

const { supabase } = require('./supabaseService');

async function logScreeningEvent(inputName, userId, ipAddress, result) {
  const logEntry = {
    input_name: inputName,
    user_id: userId,
    ip_address: ipAddress,
    result: result, // Storing the full result object as JSONB
    timestamp: new Date().toISOString(),
  };

  try {
    // Insert the log entry into the 'audit_logs' table
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([logEntry])
      .single();

    if (error) {
      console.error('Failed to write to Supabase audit log:', error);
    }
  } catch (error) {
    console.error('An unexpected error occurred in auditService:', error);
  }
}

module.exports = { logScreeningEvent };