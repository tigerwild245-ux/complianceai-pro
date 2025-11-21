// server/services/auditService.js
const { createClient } = require('@supabase/supabase-js');

const supabaseServiceRole = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { 
        auth: { 
            persistSession: false
        } 
    }
);

async function logScreeningEvent(searchQuery, userId, ipAddress, result) {
    try {
        console.log(`📝 Attempting audit log for: ${searchQuery}`); 

        const logEntry = {
            input_name: searchQuery,
            user_id: userId || 'anonymous', 
            ip_address: ipAddress || '0.0.0.0',
            result_summary: JSON.stringify(result),
            match_found: result.match_found || false,
            risk_level: result.risk_level || 'LOW',
            timestamp: new Date().toISOString()
        };

        const { error } = await supabaseServiceRole
            .from('audit_logs')
            .insert(logEntry);

        if (error) {
            console.warn('⚠️  Audit log failed:', error.message);
        } else {
            console.log('✅ Audit log saved');
        }
    } catch (error) {
        console.error('❌ Audit error:', error.message);
    }
}

module.exports = { logScreeningEvent };
