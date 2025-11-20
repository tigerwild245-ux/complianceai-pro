const express = require('express');
const cors = require('cors');
const path = require('path');
const { screenName, initializeScreeningService } = require('./services/screeningService');
const { getAuditLogs } = require('./services/auditService');
const { getDataVersions } = require('./services/dataVersioningService');
const { loadSanctionsData, loadPepData } = require('./services/supabaseService');
const falsePositiveRoutes = require('./routes/falsePositives');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/false-positives', falsePositiveRoutes);

app.get('/api/data-versions', async (req, res) => {
  try {
    const versions = await getDataVersions();
    res.json(versions);
  } catch (error) {
    console.error('Error fetching data versions:', error);
    res.status(500).json({ error: 'An internal server error occurred while fetching data versions.' });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await getAuditLogs();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'An internal server error occurred while fetching audit logs.' });
  }
});

app.post('/api/load-data', async (req, res) => {
  try {
    const sanctionsResult = await loadSanctionsData();
    const pepResult = await loadPepData();
    res.json({ 
      message: 'Data loading process initiated.',
      sanctions: sanctionsResult,
      pep: pepResult
    });
  } catch (error) {
    console.error('Data loading error:', error);
    res.status(500).json({ error: 'An internal server error occurred during data loading.' });
  }
});

app.post('/api/screen', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const userId = 'web-user'; // Replace with actual user ID if you have auth
    const ipAddress = req.ip;
    const results = await screenName(name, userId, ipAddress);
    res.json(results);
  } catch (error) {
    console.error('Screening error:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// Serve the static React app
app.use(express.static(path.join(__dirname, '../frontend/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // Initialize the screening service by loading data from Supabase
  await initializeScreeningService();
});
