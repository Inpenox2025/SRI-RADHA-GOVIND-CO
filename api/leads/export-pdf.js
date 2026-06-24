const { getSQL } = require('../../shared/db');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const JWT_SECRET = process.env.JWT_SECRET || 'sri-radha-govind-secret-key-2024';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch { return null; }
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(v) {
  if (!v && v !== 0) return '—';
  return '₹ ' + parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Lead ID is required (?id=X)' });

  try {
    const sql = getSQL();
    const rows = await sql`SELECT * FROM leads WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const lead = rows[0];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Lead_${lead.id}_${lead.full_name.replace(/\s+/g, '_')}.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a237e')
       .text('SRI RADHA GOVIND & CO', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666')
       .text('Tax Consultants & Financial Services', { align: 'center' });
    doc.moveDown(0.5);

    // Line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#c9a961').lineWidth(2).stroke();
    doc.moveDown(1);

    // Title
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#333')
       .text(`Client Report — ${lead.full_name}`, { align: 'center' });
    doc.fontSize(9).fillColor('#999')
       .text(`Generated: ${new Date().toLocaleDateString('en-IN')}  |  Status: ${(lead.status || 'enquired').toUpperCase()}`, { align: 'center' });
    doc.moveDown(1);

    // Section helper
    function section(title) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a237e').text(title);
      doc.moveTo(50, doc.y + 2).lineTo(300, doc.y + 2).strokeColor('#e0e0e0').lineWidth(1).stroke();
      doc.moveDown(0.5);
    }

    function row(label, value) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#555').text(label + ': ', { continued: true });
      doc.font('Helvetica').fillColor('#333').text(value || '—');
    }

    // 1. Client Identity
    section('Client Identity & Demographics');
    row('S.No', String(lead.id));
    row('Full Name', lead.full_name);
    row('District', lead.district);
    row('Employee Category', lead.employee_category);
    row('Date of Birth', formatDate(lead.date_of_birth));
    row('Mobile No', lead.mobile_no);
    row('Alt Mobile No', lead.alt_mobile_no);
    row('Bank Account No', lead.bank_account_no);
    row('IFSC Code', lead.ifsc_code);

    // 2. Tax & Portal
    section('Tax & Portal Credentials');
    row('PAN Card No', lead.pan_card_no);
    row('EVC / Aadhaar Status', lead.evc_status);
    row('Date of Filing', formatDate(lead.date_of_filing));
    row('Client Since', lead.client_since);
    row('Rank / Designation', lead.rank_designation);

    // 3. Financial Data
    section('Financial Data');
    row('Gross Salary', formatCurrency(lead.gross_salary));
    row('Deductions (1)', formatCurrency(lead.deduction_1));
    row('Deductions (2)', formatCurrency(lead.deduction_2));
    row('Refund', formatCurrency(lead.refund));

    // 4. Billing & Fees
    section('Billing & Fees');
    row('Total Fee', formatCurrency(lead.total_fee));
    row('Paid', formatCurrency(lead.paid));
    row('Due', formatCurrency(lead.due));
    row('Date of Payment', formatDate(lead.date_of_payment));
    row('Mode of Payment', lead.mode_of_payment);

    // 5. Notes
    section('Additional Notes');
    row('Remarks (1)', lead.remarks_1);
    row('Remarks (2)', lead.remarks_2);

    // Footer
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#c9a961').lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#999').text('This is a system-generated document from Sri Radha Govind & CO Portal.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
};
