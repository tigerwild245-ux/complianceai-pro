// server/services/falsePositiveService.js (Updated for Supabase)

const { supabase } = require('./supabaseService');

async function getFalsePositives() {
  try {
    const { data, error } = await supabase
      .from('false_positives')
      .select('*');
    
    if (error) {
      console.error('Error fetching false positives:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('An unexpected error occurred in falsePositiveService:', error);
    return [];
  }
}

async function isFalsePositive(name) {
  if (!name) return false;
  const normalizedName = name.toLowerCase().trim();
  
  try {
    const { data, error } = await supabase
      .from('false_positives')
      .select('name')
      .eq('name', normalizedName)
      .single();
    
    if (error) {
      console.error('Error checking false positive:', error);
      return false;
    }
    return !!data; // Returns true if a match was found
  } catch (error) {
    console.error('An unexpected error occurred in falsePositiveService:', error);
    return false;
  }
}

async function addFalsePositive(name) {
  if (!name) throw new Error('Name is required');

  try {
    const { error } = await supabase
      .from('false_positives')
      .insert([{ name, added_on: new Date().toISOString() }])
      .single();

    if (error) {
      console.error('Error adding false positive:', error);
      return { success: false, message: 'An internal error occurred.' };
    }
    return { success: true, message: 'Successfully added to false positive list.' };
  } catch (error) {
    console.error('An unexpected error occurred in falsePositiveService:', error);
    return { success: false, message: 'An internal error occurred.' };
  }
}

module.exports = { getFalsePositives, isFalsePositive, addFalsePositive };