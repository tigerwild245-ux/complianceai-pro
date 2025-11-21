require('dotenv').config();
console.log('🔍 DEBUG - Loaded FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('🔍 DEBUG - NODE_ENV:', process.env.NODE_ENV);
const express = require('express');
const cors = require('cors');
const path = require('path');
const { screenName } = require('./services/screeningService');
const falsePositiveRoutes = require('./routes/falsePositives');
const sanctionsRoutes = require('./routes/sanctions');
const authRoutes = require('./routes/auth');
const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration with regex patterns
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    const allowedPatterns = [
      /^https:\/\/.*complianceai.*\.vercel\.app$/,  // More flexible pattern for Vercel
      /^https:\/\/.*\.github\.dev$/,
      /^http:\/\/localhost(:\d+)?$/,  // Allow localhost with any port
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    const isAllowed = allowedPatterns.some(pattern => {
      if (typeof pattern === 'string') return origin === pattern;
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
  maxAge: 86400
};
app.use(cors(corsOptions));

// Explicit OPTIONS handler for all routes
app.options('*', cors(corsOptions));

// 2. JSON Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger setup
const logger = {
  info: (message) => console.log(`[${new Date().toISOString()}] INFO: ${message}`),
  error: (message) => console.error(`[${new Date().toISOString()}] ERROR: ${message}`),
  warn: (message) => console.warn(`[${new Date().toISOString()}] WARN: ${message}`)
};

// 3. Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  req.start = start;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    logger.info(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ` +
      `${res.statusCode} ${duration}ms Memory: ${memoryMB}MB`
    );
  });
  
  next();
});

// ====================================
// ROUTES
// ====================================

// Health Check Route
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Authentication Routes (login, register, etc.)
app.use('/api/auth', authRoutes);

// False Positives Routes
app.use('/api/false-positives', falsePositiveRoutes);

// Sanctions Routes
app.use('/api/sanctions', sanctionsRoutes);

// Main Screening Endpoint
app.post('/api/screen', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Invalid input: Name is required and must be a non-empty string' 
      });
    }

    logger.info(`Screening request for: ${name}`);
    
    const result = await screenName(name);
    
    res.json(result);
  } catch (error) {
    logger.error(`Screening error: ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error during screening',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../client/build');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    message: 'The requested resource does not exist'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  logger.error(err.stack);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ====================================
// SERVER STARTUP - THIS WAS MISSING!
// ====================================

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 ComplianceAI Pro Server Started                      ║
║                                                            ║
║   📡 Port: ${PORT}                                        ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                               ║
║   🔒 Auth: Enabled                                         ║
║   📋 Available Endpoints:                                  ║
║      - POST /api/auth/register                             ║
║      - POST /api/auth/login                                ║
║      - POST /api/screen                                    ║
║      - GET  /api/health                                    ║
║      - GET  /api/sanctions                                 ║
║      - POST /api/false-positives                           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful Shutdown Handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Unhandled Promise Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
