const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sri-radha-govind-secret-key-2024';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
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
};
