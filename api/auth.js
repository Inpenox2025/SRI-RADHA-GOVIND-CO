const { getSQL } = require('../shared/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sri-radha-govind-secret-key-2024';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Determine action based on query parameter or URL path
  const action = req.query.action || (req.url && req.url.includes('/login') ? 'login' : req.url && req.url.includes('/me') ? 'me' : null);

  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const sql = getSQL();
      const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed', details: error.message });
    }
  } else if (action === 'me') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      return res.status(200).json({
        success: true,
        user: { id: decoded.id, username: decoded.username, role: decoded.role }
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } else {
    return res.status(404).json({ error: 'Not found' });
  }
};
