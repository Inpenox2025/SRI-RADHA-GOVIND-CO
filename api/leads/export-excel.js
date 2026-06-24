const { sql } = require('@vercel/postgres');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const status = req.query.status || '';
    let result;

    if (status) {
      result = await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC`;
    } else {
      result = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
    }

    const leads = result.rows;

    const data = leads.map((l, i) => ({
      'S.No': i + 1,
      'Status': (l.status || '').toUpperCase(),
      'Full Name': l.full_name || '',
      'District': l.district || '',
      'Employee Category': l.employee_category || '',
      'Date of Birth': l.date_of_birth ? new Date(l.date_of_birth).toLocaleDateString('en-IN') : '',
      'Mobile No': l.mobile_no || '',
      'Alt Mobile No': l.alt_mobile_no || '',
      'Bank Account No': l.bank_account_no || '',
      'IFSC Code': l.ifsc_code || '',
      'PAN Card No': l.pan_card_no || '',
      'EVC Status': l.evc_status || '',
      'Date of Filing': l.date_of_filing ? new Date(l.date_of_filing).toLocaleDateString('en-IN') : '',
      'Client Since': l.client_since || '',
      'Rank / Designation': l.rank_designation || '',
      'Gross Salary': l.gross_salary || '',
      'Deduction 1': l.deduction_1 || '',
      'Deduction 2': l.deduction_2 || '',
      'Refund': l.refund || '',
      'Total Fee': l.total_fee || '',
      'Paid': l.paid || '',
      'Due': l.due || '',
      'Date of Payment': l.date_of_payment ? new Date(l.date_of_payment).toLocaleDateString('en-IN') : '',
      'Mode of Payment': l.mode_of_payment || '',
      'Remarks 1': l.remarks_1 || '',
      'Remarks 2': l.remarks_2 || '',
      'Created At': l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { width: 6 }, { width: 14 }, { width: 25 }, { width: 18 }, { width: 20 },
      { width: 14 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 18 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 25 },
      { width: 25 }, { width: 14 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Leads_Export_${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    return res.status(500).json({ error: 'Failed to export Excel', details: error.message });
  }
};
