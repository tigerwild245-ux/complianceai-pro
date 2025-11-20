const express = require('express');
const cors = require('cors');
const path = require('path');
const { screenName } = require('./services/screeningService');
const falsePositiveRoutes = require('./routes/falsePositives');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/false-positives', falsePositiveRoutes);

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
