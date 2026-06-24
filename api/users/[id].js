const { sql } = require('@vercel/postgres');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'sri-radha-govind-secret-key-2024';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID is required' });

  // PUT — update sub-admin
  if (req.method === 'PUT') {
    try {
      // Don't allow editing admin user role
      const { rows: check } = await sql`SELECT role FROM users WHERE id = ${id}`;
      if (check.length === 0) return res.status(404).json({ error: 'User not found' });

      const { username, password } = req.body;
      if (password) {
        const hash = await bcrypt.hash(password, 10);
        await sql`UPDATE users SET username = ${username}, password_hash = ${hash} WHERE id = ${id}`;
      } else {
        await sql`UPDATE users SET username = ${username} WHERE id = ${id}`;
      }

      const { rows } = await sql`SELECT id, username, role, created_at FROM users WHERE id = ${id}`;
      return res.status(200).json({ success: true, user: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
  }

  // DELETE — delete sub-admin (cannot delete admin)
  if (req.method === 'DELETE') {
    try {
      const { rows: check } = await sql`SELECT role FROM users WHERE id = ${id}`;
      if (check.length === 0) return res.status(404).json({ error: 'User not found' });
      if (check[0].role === 'admin') return res.status(400).json({ error: 'Cannot delete admin user' });

      await sql`DELETE FROM users WHERE id = ${id}`;
      return res.status(200).json({ success: true, message: 'User deleted' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
