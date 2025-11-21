// server/routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// In-memory user storage (replace with database in production)
const users = new Map();

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    console.log('📝 Registration attempt:', { fullName, email });

    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const emailLower = email.toLowerCase();

    // Check if user already exists
    if (users.has(emailLower)) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user object
    const user = {
      id: Date.now().toString(),
      fullName,
      email: emailLower,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    // Store user
    users.set(emailLower, user);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ User registered successfully:', emailLower);

    // Send response (don't send password)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt:', { email });

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const emailLower = email.toLowerCase();

    // Find user
    const user = users.get(emailLower);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful:', emailLower);

    // Send response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user (protected route)
 */
router.get('/me', authenticateToken, (req, res) => {
  const user = users.get(req.user.email);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    }
  });
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * Middleware to authenticate JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = user;
    next();
  });
}

// Export middleware for use in other routes
router.authenticateToken = authenticateToken;

module.exports = router;