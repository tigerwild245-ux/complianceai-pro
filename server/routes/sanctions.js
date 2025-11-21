const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

/**
 * GET /api/sanctions
 * Get all sanctions from the database
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sanctions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sanctions:', error);
      return res.status(500).json({ error: 'Failed to fetch sanctions' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/sanctions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sanctions
 * Add a new sanction to the database
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, country, reason } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const { data, error } = await supabase
      .from('sanctions')
      .insert([{ name, type, country, reason }])
      .select();

    if (error) {
      console.error('Error adding sanction:', error);
      return res.status(500).json({ error: 'Failed to add sanction' });
    }

    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error in POST /api/sanctions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/sanctions/:id
 * Delete a sanction from the database
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('sanctions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting sanction:', error);
      return res.status(500).json({ error: 'Failed to delete sanction' });
    }

    res.json({ message: 'Sanction deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/sanctions/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
