// server/server.js
// Load environment variables immediately
require('dotenv').config(); 
const express = require('express');
const cors = require('cors'); 
const path = require('path');

// 1. Import the new router for the core screening logic
const scanRouter = require('./routes/scanRouter'); 
// 2. Import your existing routes
const falsePositiveRoutes = require('./routes/falsePositives');
const sanctionsRoutes = require('./routes/sanctions');

const app = express();
const PORT = process.env.PORT || 5000;

// === Middleware Setup ===
// 1. CORS: Allows your Vercel frontend to talk to this Render backend
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// 2. JSON Parser
app.use(express.json());

// === Routes ===
// Existing Routes
app.use('/api/false-positives', falsePositiveRoutes);
app.use('/api/sanctions', sanctionsRoutes);

// New/Core Scanning Route
app.use('/api', scanRouter); 

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Root Health Check
app.get('/', (req, res) => {
    res.send('Compliance AI Server is Running!');
});

// === Server Start ===
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Connected' : 'MISSING'}`);
    console.log(`Gemini Key: ${process.env.GEMINI_API_KEY ? 'Connected' : 'MISSING'}`);
});
