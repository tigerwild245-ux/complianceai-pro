const supabase = require('../config/supabaseClient');

async function listTables() {
  console.log('🔍 Fetching all tables from database...\n');
  
  try {
    // Query the information_schema to get all tables
    const { data, error } = await supabase.rpc('get_tables_info', {});
    
    if (error) {
      console.log('⚠️  RPC function not available. Trying alternative method...\n');
      
      // Alternative: Try to query common table names
      const testTables = [
        'sanctioned_entities', 'peps', 'entities', 'screening_data',
        'users', 'profiles', 'sanctions', 'watchlist', 'blacklist'
      ];
      
      console.log('Testing common table names:\n');
      for (const tableName of testTables) {
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            console.log(`✅ ${tableName} - ${count || 0} rows`);
          }
        } catch (err) {
          // Skip silently
        }
      }
    } else {
      console.log('📋 Available Tables:');
      console.log(data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

listTables().then(() => {
  console.log('\n💡 If no tables were found, you may need to create your screening table first.');
  process.exit(0);
});
