// server/services/supabaseService.js
const { createClient } = require('@supabase/supabase-js');
const sanctionsData = require('../data/sanctions_optimized.json'); // Optimized data
const dummyPepList = require('../data/dummy_pep_list.json'); // Dummy PEP data

// Initialize the Supabase client
// NOTE: The user's environment variables for SUPABASE_URL and SUPABASE_ANON_KEY
// are assumed to be set for this to work in a real deployment.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const SANCTIONS_TABLE = 'sanctions_list';
const PEP_TABLE = 'pep_list';

/**
 * Loads the optimized sanctions data into the Supabase table.
 * This function is for initial setup and data updates.
 * It uses the optimized data structure to respect the 0.5GB limit.
 */
async function loadSanctionsData() {
  console.log(`Attempting to load ${sanctionsData.length} sanctions records into Supabase...`);
  try {
    // 1. Clear existing data (optional, but good for a fresh load)
    const { error: deleteError } = await supabase
      .from(SANCTIONS_TABLE)
      .delete()
      .neq('id', 'placeholder'); // Delete all rows

    if (deleteError) {
      console.error('Error clearing sanctions table:', deleteError);
      return { success: false, error: deleteError };
    }

    // 2. Insert new data in batches to handle large datasets
    const batchSize = 1000;
    for (let i = 0; i < sanctionsData.length; i += batchSize) {
      const batch = sanctionsData.slice(i, i + batchSize).map(item => ({
        id: item.id,
        list_type: item.list_type,
        names: item.names, // Array of names/aliases
        designation: item.designation,
        country: item.country,
        // full_data is kept as JSONB in the DB for match transparency
        full_data: item.full_data, 
      }));

      const { error: insertError } = await supabase
        .from(SANCTIONS_TABLE)
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch starting at index ${i}:`, insertError);
        return { success: false, error: insertError };
      }
      console.log(`Successfully inserted batch ${i/batchSize + 1}`);
    }

    console.log('Sanctions data successfully loaded into Supabase.');
    return { success: true };
  } catch (e) {
    console.error('An unexpected error occurred during sanctions data loading:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Loads the dummy PEP data into the Supabase table.
 */
async function loadPepData() {
  console.log(`Attempting to load ${dummyPepList.length} PEP records into Supabase...`);
  try {
    // 1. Clear existing data
    await supabase.from(PEP_TABLE).delete().neq('name', 'placeholder');

    // 2. Insert new data
    const { error: insertError } = await supabase
      .from(PEP_TABLE)
      .insert(dummyPepList);

    if (insertError) {
      console.error('Error inserting PEP data:', insertError);
      return { success: false, error: insertError };
    }

    console.log('PEP data successfully loaded into Supabase.');
    return { success: true };
  } catch (e) {
    console.error('An unexpected error occurred during PEP data loading:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Retrieves all sanctions data from Supabase.
 * NOTE: For a real-world application, this should be an API endpoint 
 * that queries the DB based on search criteria, not a full table dump.
 * However, for the current screening logic, we need the full list in memory.
 */
async function getSanctionsData() {
  const { data, error } = await supabase
    .from(SANCTIONS_TABLE)
    .select('*');

  if (error) {
    console.error('Error retrieving sanctions data:', error);
    return null;
  }
  return data;
}

/**
 * Retrieves all PEP data from Supabase.
 */
async function getPepData() {
  const { data, error } = await supabase
    .from(PEP_TABLE)
    .select('*');

  if (error) {
    console.error('Error retrieving PEP data:', error);
    return null;
  }
  return data;
}

module.exports = { 
  supabase, 
  loadSanctionsData, 
  loadPepData, 
  getSanctionsData, 
  getPepData 
};
