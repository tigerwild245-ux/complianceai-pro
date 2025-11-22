const supabase = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthController {
  // POST /api/auth/register
  async register(req, res) {
    try {
      const { fullName, email, password } = req.body;

      // Validate
      if (!fullName || !email || !password) {
        return res.status(400).json({ error: 'All fields required' });
      }

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Insert into Supabase
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{
          full_name: fullName,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          role: 'user'
        }])
        .select()
        .single();

      if (error) throw error;

      // Generate JWT token
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        token,
        user: {
          id: newUser.id,
          fullName: newUser.full_name,
          email: newUser.email,
          role: newUser.role
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Fetch user from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last_login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  // GET /api/auth/me (verify token)
  async getCurrentUser(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
      if (!token) return res.status(401).json({ error: 'No token' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch fresh user data
      const { data: user, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, created_at')
        .eq('id', decoded.userId)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

module.exports = new AuthController();