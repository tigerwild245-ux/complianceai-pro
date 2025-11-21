const supabase = require('../config/supabaseClient');

async function checkSchema() {
  console.log('🔍 Checking current database schema...\n');
  
  // Try common table names
  const tables = ['sanctioned_entities', 'peps', 'entities', 'screening_data'];
  
  for (const tableName of tables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);
      
      if (!error && data) {
        console.log(`✅ Found table: ${tableName}`);
        console.log(`   Row count: ${count || 'unknown'}`);
        if (data.length > 0) {
          console.log(`   Columns:`, Object.keys(data[0]).join(', '));
          console.log(`   Sample name:`, data[0].name || 'N/A');
        }
        console.log('');
      }
    } catch (err) {
      // Table doesn't exist, skip
    }
  }
}

checkSchema().then(() => process.exit(0));
