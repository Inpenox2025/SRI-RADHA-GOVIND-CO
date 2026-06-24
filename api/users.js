const { getSQL } = require('../shared/db');
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
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const id = req.query.id;
  const sql = getSQL();

  // 1. SINGLE USER CRUD (if ID is present)
  if (id) {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    // PUT — update sub-admin
    if (req.method === 'PUT') {
      try {
        const check = await sql`SELECT role FROM users WHERE id = ${id}`;
        if (check.length === 0) return res.status(404).json({ error: 'User not found' });

        const { username, password } = req.body;
        if (password) {
          const hash = await bcrypt.hash(password, 10);
          await sql`UPDATE users SET username = ${username}, password_hash = ${hash} WHERE id = ${id}`;
        } else {
          await sql`UPDATE users SET username = ${username} WHERE id = ${id}`;
        }

        const rows = await sql`SELECT id, username, role, created_at FROM users WHERE id = ${id}`;
        return res.status(200).json({ success: true, user: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update user', details: error.message });
      }
    }

    // DELETE — delete sub-admin (cannot delete admin)
    if (req.method === 'DELETE') {
      try {
        const check = await sql`SELECT role FROM users WHERE id = ${id}`;
        if (check.length === 0) return res.status(404).json({ error: 'User not found' });
        if (check[0].role === 'admin') return res.status(400).json({ error: 'Cannot delete admin user' });

        await sql`DELETE FROM users WHERE id = ${id}`;
        return res.status(200).json({ success: true, message: 'User deleted' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete user', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. USER COLLECTION (if no ID)
  else {
    // GET — list sub-admins
    if (req.method === 'GET') {
      try {
        const rows = await sql`SELECT id, username, role, created_at FROM users ORDER BY created_at ASC`;
        return res.status(200).json({ success: true, users: rows });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
      }
    }

    // POST — create sub-admin (max 2 limit)
    if (req.method === 'POST') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Only admin can create users' });

      try {
        const countRows = await sql`SELECT COUNT(*) as total FROM users WHERE role = 'sub_admin'`;
        if (parseInt(countRows[0].total) >= 2) {
          return res.status(400).json({ error: 'Maximum 2 sub-admin users allowed' });
        }

        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

        const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

        const hash = await bcrypt.hash(password, 10);
        const rows = await sql`
          INSERT INTO users (username, password_hash, role)
          VALUES (${username}, ${hash}, 'sub_admin')
          RETURNING id, username, role, created_at
        `;

        return res.status(201).json({ success: true, user: rows[0] });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to create user', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }
};
