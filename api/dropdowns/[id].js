const { getSQL } = require('../../shared/db');
const jwt = require('jsonwebtoken');

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
  if (!id) return res.status(400).json({ error: 'ID is required' });

  const sql = getSQL();

  // PUT — update dropdown
  if (req.method === 'PUT') {
    try {
      const { label, sort_order } = req.body;
      const rows = await sql`
        UPDATE dropdowns SET label = ${label}, sort_order = ${sort_order || 0}
        WHERE id = ${id} RETURNING *
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Dropdown not found' });
      return res.status(200).json({ success: true, dropdown: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update dropdown', details: error.message });
    }
  }

  // DELETE — delete dropdown
  if (req.method === 'DELETE') {
    try {
      const rows = await sql`DELETE FROM dropdowns WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: 'Dropdown not found' });
      return res.status(200).json({ success: true, message: 'Dropdown deleted' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete dropdown', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
