const supabase = require('../config/supabaseClient');

/**
 * Supabase Service
 * Provides database operations for sanctions screening
 */

// Get all sanctions from the database
async function getAllSanctions() {
  try {
    const { data, error } = await supabase
      .from('sanctions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sanctions:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllSanctions:', error);
    throw error;
  }
}

// Search sanctions by name
async function searchSanctions(query) {
  try {
    const { data, error } = await supabase
      .from('sanctions')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching sanctions:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchSanctions:', error);
    throw error;
  }
}

// Add a new sanction
async function addSanction(sanctionData) {
  try {
    const { data, error } = await supabase
      .from('sanctions')
      .insert([sanctionData])
      .select();

    if (error) {
      console.error('Error adding sanction:', error);
      throw error;
    }

    return data[0];
  } catch (error) {
    console.error('Error in addSanction:', error);
    throw error;
  }
}

// Update a sanction
async function updateSanction(id, updates) {
  try {
    const { data, error } = await supabase
      .from('sanctions')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating sanction:', error);
      throw error;
    }

    return data[0];
  } catch (error) {
    console.error('Error in updateSanction:', error);
    throw error;
  }
}

// Delete a sanction
async function deleteSanction(id) {
  try {
    const { error } = await supabase
      .from('sanctions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting sanction:', error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteSanction:', error);
    throw error;
  }
}

module.exports = {
  getAllSanctions,
  searchSanctions,
  addSanction,
  updateSanction,
  deleteSanction
};
