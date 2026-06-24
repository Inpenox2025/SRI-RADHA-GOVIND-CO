const { sql } = require('@vercel/postgres');
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

  // GET — list dropdowns (public, no auth for enquiry form)
  if (req.method === 'GET') {
    try {
      const category = req.query.category || '';
      let result;

      if (category) {
        result = await sql`SELECT * FROM dropdowns WHERE category = ${category} ORDER BY sort_order ASC, label ASC`;
      } else {
        result = await sql`SELECT * FROM dropdowns ORDER BY category ASC, sort_order ASC, label ASC`;
      }

      // Group by category
      const grouped = {};
      result.rows.forEach(row => {
        if (!grouped[row.category]) grouped[row.category] = [];
        grouped[row.category].push(row);
      });

      return res.status(200).json({ success: true, dropdowns: result.rows, grouped });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch dropdowns', details: error.message });
    }
  }

  // POST — create dropdown (auth required)
  if (req.method === 'POST') {
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { category, label, sort_order } = req.body;
      if (!category || !label) return res.status(400).json({ error: 'Category and label are required' });

      const { rows } = await sql`
        INSERT INTO dropdowns (category, label, sort_order)
        VALUES (${category}, ${label}, ${sort_order || 0})
        RETURNING *
      `;

      return res.status(201).json({ success: true, dropdown: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to create dropdown', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
