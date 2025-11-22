const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient'); // 🆕 ADDED

// Use environment variable (NEVER hardcode in production!)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET not set in environment variables');
  process.exit(1); // Prevent startup without secret
}

/**
 * POST /api/auth/register
 * Register a new user → Persist to Supabase
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const emailLower = email.toLowerCase();

    // 🆕 Check if user exists in Supabase
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .eq('email', emailLower)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Check user error:', checkError);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 🆕 Insert into Supabase
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        full_name: fullName,
        email: emailLower,
        password_hash: passwordHash,
        role: 'user'
      }])
      .select('id, full_name, email, role, created_at')
      .single();

    if (insertError) {
      console.error('Insert user error:', insertError);
      return res.status(500).json({ success: false, message: 'Failed to create user' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ User registered successfully in Supabase:', emailLower);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        fullName: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.created_at
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
 * Login existing user → Verify from Supabase
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt:', { email });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const emailLower = email.toLowerCase();

    // 🆕 Fetch user from Supabase
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', emailLower)
      .single();

    if (fetchError || !user) {
      console.log('User not found:', emailLower);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // 🆕 Update last_login
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.warn('Failed to update last_login:', updateError);
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

    console.log('✅ Login successful for user:', emailLower);

    // Don't send password_hash to client
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: userWithoutPassword.id,
        fullName: userWithoutPassword.full_name,
        email: userWithoutPassword.email,
        role: userWithoutPassword.role,
        createdAt: userWithoutPassword.created_at,
        lastLogin: userWithoutPassword.last_login
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
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // 🆕 Fetch fresh user data from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, created_at, last_login')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('❌ Auth me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
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