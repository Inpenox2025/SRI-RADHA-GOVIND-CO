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

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID is required' });

  // GET — single lead
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`SELECT * FROM leads WHERE id = ${id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json({ success: true, lead: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch lead', details: error.message });
    }
  }

  // PUT — update lead
  if (req.method === 'PUT') {
    try {
      const d = req.body;
      const due = (parseFloat(d.total_fee) || 0) - (parseFloat(d.paid) || 0);

      const { rows } = await sql`
        UPDATE leads SET
          status = ${d.status || 'enquired'},
          full_name = ${d.full_name},
          district = ${d.district || null},
          employee_category = ${d.employee_category || null},
          date_of_birth = ${d.date_of_birth || null},
          mobile_no = ${d.mobile_no || null},
          alt_mobile_no = ${d.alt_mobile_no || null},
          bank_account_no = ${d.bank_account_no || null},
          ifsc_code = ${d.ifsc_code || null},
          pan_card_no = ${d.pan_card_no || null},
          portal_password = ${d.portal_password || null},
          evc_status = ${d.evc_status || null},
          date_of_filing = ${d.date_of_filing || null},
          client_since = ${d.client_since || null},
          rank_designation = ${d.rank_designation || null},
          gross_salary = ${d.gross_salary || null},
          deduction_1 = ${d.deduction_1 || null},
          deduction_2 = ${d.deduction_2 || null},
          refund = ${d.refund || null},
          total_fee = ${d.total_fee || null},
          paid = ${d.paid || null},
          due = ${due || null},
          date_of_payment = ${d.date_of_payment || null},
          mode_of_payment = ${d.mode_of_payment || null},
          remarks_1 = ${d.remarks_1 || null},
          remarks_2 = ${d.remarks_2 || null},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json({ success: true, lead: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update lead', details: error.message });
    }
  }

  // DELETE — delete lead
  if (req.method === 'DELETE') {
    try {
      const { rowCount } = await sql`DELETE FROM leads WHERE id = ${id}`;
      if (rowCount === 0) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json({ success: true, message: 'Lead deleted' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete lead', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
