const { getSQL } = require('../../shared/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getSQL();
    const rows = await sql`SELECT * FROM testimonials ORDER BY created_at DESC`;
    return res.status(200).json({ success: true, testimonials: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch testimonials', details: error.message });
  }
};
