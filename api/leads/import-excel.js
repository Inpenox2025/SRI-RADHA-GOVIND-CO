const { sql } = require('@vercel/postgres');
const jwt = require('jsonwebtoken');
const formidable = require('formidable');
const XLSX = require('xlsx');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'sri-radha-govind-secret-key-2024';

// Disable Vercel body parser for file upload
module.exports.config = { api: { bodyParser: false } };

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch { return null; }
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// Map common Excel column headers to DB fields
const COLUMN_MAP = {
  'full name': 'full_name', 'name': 'full_name', 'client name': 'full_name',
  'district': 'district',
  'employee category': 'employee_category', 'category': 'employee_category',
  'date of birth': 'date_of_birth', 'dob': 'date_of_birth',
  'mobile no': 'mobile_no', 'mobile': 'mobile_no', 'phone': 'mobile_no',
  'alt mobile no': 'alt_mobile_no', 'alternative mobile': 'alt_mobile_no',
  'bank account no': 'bank_account_no', 'account no': 'bank_account_no',
  'ifsc code': 'ifsc_code', 'ifsc': 'ifsc_code',
  'pan card no': 'pan_card_no', 'pan': 'pan_card_no', 'pan no': 'pan_card_no',
  'password': 'portal_password', 'portal password': 'portal_password',
  'evc status': 'evc_status', 'evc': 'evc_status',
  'date of filing': 'date_of_filing',
  'client since': 'client_since',
  'rank / designation': 'rank_designation', 'rank': 'rank_designation', 'designation': 'rank_designation',
  'gross salary': 'gross_salary', 'salary': 'gross_salary',
  'deduction 1': 'deduction_1', 'deductions (1)': 'deduction_1',
  'deduction 2': 'deduction_2', 'deductions (2)': 'deduction_2',
  'refund': 'refund',
  'total fee': 'total_fee', 'fee': 'total_fee',
  'paid': 'paid',
  'due': 'due',
  'date of payment': 'date_of_payment',
  'mode of payment': 'mode_of_payment', 'payment mode': 'mode_of_payment',
  'remarks 1': 'remarks_1', 'remarks': 'remarks_1',
  'remarks 2': 'remarks_2',
  'status': 'status'
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { files } = await parseForm(req);
    const file = files.file?.[0] || files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = file.filepath || file.path;
    const buffer = fs.readFileSync(filePath);
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    let imported = 0;
    let errors = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const d = {};

      // Map columns
      for (const [key, value] of Object.entries(raw)) {
        const normalizedKey = key.toLowerCase().trim();
        const dbField = COLUMN_MAP[normalizedKey];
        if (dbField) d[dbField] = value;
      }

      if (!d.full_name) {
        errors.push(`Row ${i + 2}: Missing full name, skipped`);
        continue;
      }

      try {
        const due = (parseFloat(d.total_fee) || 0) - (parseFloat(d.paid) || 0);
        await sql`
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
            ${d.mobile_no ? String(d.mobile_no) : null}, ${d.alt_mobile_no ? String(d.alt_mobile_no) : null}, ${d.bank_account_no || null}, ${d.ifsc_code || null},
            ${d.pan_card_no || null}, ${d.portal_password || null}, ${d.evc_status || null}, ${d.date_of_filing || null},
            ${d.client_since || null}, ${d.rank_designation || null},
            ${d.gross_salary || null}, ${d.deduction_1 || null}, ${d.deduction_2 || null}, ${d.refund || null},
            ${d.total_fee || null}, ${d.paid || null}, ${due || null}, ${d.date_of_payment || null}, ${d.mode_of_payment || null},
            ${d.remarks_1 || null}, ${d.remarks_2 || null}
          )
        `;
        imported++;
      } catch (err) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch {}

    return res.status(200).json({
      success: true,
      message: `Imported ${imported} of ${rows.length} leads`,
      imported,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Excel import error:', error);
    return res.status(500).json({ error: 'Failed to import Excel', details: error.message });
  }
};
