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

  // POST — create lead (public for enquiry form, no auth needed)
  if (req.method === 'POST') {
    try {
      const d = req.body;
      if (!d.full_name) return res.status(400).json({ error: 'Full name is required' });

      const due = (parseFloat(d.total_fee) || 0) - (parseFloat(d.paid) || 0);

      const { rows } = await sql`
        INSERT INTO leads (
          status, full_name, district, employee_category, date_of_birth,
          mobile_no, alt_mobile_no, bank_account_no, ifsc_code,
          pan_card_no, portal_password, evc_status, date_of_filing,
          client_since, rank_designation,
          gross_salary, deduction_1, deduction_2, refund,
          total_fee, paid, due, date_of_payment, mode_of_payment,
          remarks_1, remarks_2
        ) VALUES (
          ${d.status || 'enquired'}, ${d.full_name}, ${d.district || null}, ${d.employee_category || null}, ${d.date_of_birth || null},
          ${d.mobile_no || null}, ${d.alt_mobile_no || null}, ${d.bank_account_no || null}, ${d.ifsc_code || null},
          ${d.pan_card_no || null}, ${d.portal_password || null}, ${d.evc_status || null}, ${d.date_of_filing || null},
          ${d.client_since || null}, ${d.rank_designation || null},
          ${d.gross_salary || null}, ${d.deduction_1 || null}, ${d.deduction_2 || null}, ${d.refund || null},
          ${d.total_fee || null}, ${d.paid || null}, ${due || null}, ${d.date_of_payment || null}, ${d.mode_of_payment || null},
          ${d.remarks_1 || null}, ${d.remarks_2 || null}
        ) RETURNING *
      `;

      return res.status(201).json({ success: true, lead: rows[0] });
    } catch (error) {
      console.error('Create lead error:', error);
      return res.status(500).json({ error: 'Failed to create lead', details: error.message });
    }
  }

  // GET — list leads with pagination, search, filters (auth required)
  if (req.method === 'GET') {
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 15;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status || '';
      const district = req.query.district || '';

      let countQuery, dataQuery;

      if (search && status && district) {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status} AND district = ${district}`;
        dataQuery = await sql`SELECT * FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status} AND district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      } else if (search && status) {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status}`;
        dataQuery = await sql`SELECT * FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      } else if (search && district) {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND district = ${district}`;
        dataQuery = await sql`SELECT * FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      } else if (status && district) {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads WHERE status = ${status} AND district = ${district}`;
        dataQuery = await sql`SELECT * FROM leads WHERE status = ${status} AND district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      } else if (search) {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads WHERE full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}`;
        dataQuery = await sql`SELECT * FROM leads WHERE full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      } else if (status) {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads WHERE status = ${status}`;
        dataQuery = await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      } else if (district) {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads WHERE district = ${district}`;
        dataQuery = await sql`SELECT * FROM leads WHERE district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      } else {
        countQuery = await sql`SELECT COUNT(*) as total FROM leads`;
        dataQuery = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      }

      const total = parseInt(countQuery.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return res.status(200).json({
        success: true,
        leads: dataQuery.rows,
        pagination: { page, limit, total, totalPages }
      });
    } catch (error) {
      console.error('List leads error:', error);
      return res.status(500).json({ error: 'Failed to fetch leads', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
