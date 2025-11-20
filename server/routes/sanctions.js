const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY  // Changed from SUPABASE_SERVICE_ROLE_KEY
);

// GET endpoint to retrieve all sanctions
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sanctions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('Error fetching sanctions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sanctions data',
      message: error.message
    });
  }
});

// POST endpoint to trigger data import
router.post('/load-data', async (req, res) => {
  try {
    console.log('Starting sanctions data import...');
    
    // Get the correct path to the script (go up one level from server/)
    const scriptPath = path.join(__dirname, '../../scripts/import_all_sanctions.py');
    console.log('Script path:', scriptPath);
    
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`);
    
    console.log('Import output:', stdout);
    if (stderr) console.error('Import warnings:', stderr);
    
    res.json({ 
      success: true, 
      message: 'Sanctions data imported successfully',
      details: stdout
    });
    
  } catch (error) {
    console.error('Import failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Data import failed',
      message: error.message 
    });
  }
});

module.exports = router;
