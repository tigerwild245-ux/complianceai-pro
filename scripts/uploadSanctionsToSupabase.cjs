require('dotenv').config({ path: './server/.env' });

const fs = require('fs').promises;
const { supabase } = require('../server/services/supabaseService');

async function uploadData() {
  console.log('Starting data upload to Supabase...');
  const dataPath = './server/data/sanctions_enriched.json';

  try {
    const fileContent = await fs.readFile(dataPath, 'utf8');
    const sanctionsData = JSON.parse(fileContent);

    if (!sanctionsData || sanctionsData.length === 0) {
      console.log('❌ No data found in sanctions_enriched.json to upload.');
      return;
    }

    console.log(`Found ${sanctionsData.length} entries to upload.`);

    const transformedData = sanctionsData.map(item => {
      const { name, type, bio, ...rest } = item;
      return {
        name: name,
        type: type || 'Unknown',
        bio: bio,
        details: Object.keys(rest).length > 0 ? rest : null
      };
    });

    console.log('Clearing existing data...');
    const { error: deleteError } = await supabase
      .from('sanctions_list')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.warn('Warning clearing data:', deleteError.message);
    }

    const batchSize = 1000;
    let uploaded = 0;

    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      
      console.log(`Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedData.length / batchSize)}...`);

      const { data, error } = await supabase
        .from('sanctions_list')
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Error uploading batch:`, error);
        throw error;
      }

      uploaded += batch.length;
      console.log(`✅ Uploaded ${uploaded}/${transformedData.length} entries`);
    }

    console.log(`\n🎉 Successfully uploaded ${uploaded} sanctions to Supabase!`);
    
    const { count, error: countError } = await supabase
      .from('sanctions_list')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 Total records in database: ${count}`);
    }

  } catch (error) {
    console.error('❌ Error uploading data to Supabase:', error.message);
    process.exit(1);
  }
}

uploadData();
