const { getSQL } = require('../shared/db');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');

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

  const action = req.query.action;
  const id = req.query.id;
  const sql = getSQL();

  // 1. ACTION: Export Excel (GET)
  if (action === 'export-excel') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const status = req.query.status || '';
      let leads;

      if (status) {
        leads = await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC`;
      } else {
        leads = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
      }

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
  }

  // 2. ACTION: Export PDF (GET)
  if (action === 'export-pdf') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const pdfId = req.query.id;
    if (!pdfId) return res.status(400).json({ error: 'Lead ID is required (?id=X)' });

    try {
      const rows = await sql`SELECT * FROM leads WHERE id = ${pdfId}`;
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
  }

  // 3. SINGLE LEAD CRUD (if ID query param is present)
  else if (id) {
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // GET — single lead
    if (req.method === 'GET') {
      try {
        const rows = await sql`SELECT * FROM leads WHERE id = ${id}`;
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

        const rows = await sql`
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
        const rows = await sql`DELETE FROM leads WHERE id = ${id} RETURNING id`;
        if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
        return res.status(200).json({ success: true, message: 'Lead deleted' });
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete lead', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 4. COLLECTION OPERATIONS (if no action and no ID)
  else {
    // POST — create lead (public, no auth)
    if (req.method === 'POST') {
      try {
        const d = req.body;
        if (!d.full_name) return res.status(400).json({ error: 'Full name is required' });

        const due = (parseFloat(d.total_fee) || 0) - (parseFloat(d.paid) || 0);

        const rows = await sql`
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

    // GET — list leads with pagination/filters (auth required)
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

        let countRows, dataRows;

        if (search && status && district) {
          countRows = await sql`SELECT COUNT(*) as total FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status} AND district = ${district}`;
          dataRows = await sql`SELECT * FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status} AND district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        } else if (search && status) {
          countRows = await sql`SELECT COUNT(*) as total FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status}`;
          dataRows = await sql`SELECT * FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND status = ${status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        } else if (search && district) {
          countRows = await sql`SELECT COUNT(*) as total FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND district = ${district}`;
          dataRows = await sql`SELECT * FROM leads WHERE (full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}) AND district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        } else if (status && district) {
          countRows = await sql`SELECT COUNT(*) as total FROM leads WHERE status = ${status} AND district = ${district}`;
          dataRows = await sql`SELECT * FROM leads WHERE status = ${status} AND district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        } else if (search) {
          countRows = await sql`SELECT COUNT(*) as total FROM leads WHERE full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'}`;
          dataRows = await sql`SELECT * FROM leads WHERE full_name ILIKE ${'%' + search + '%'} OR mobile_no ILIKE ${'%' + search + '%'} OR pan_card_no ILIKE ${'%' + search + '%'} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        } else if (status) {
          countRows = await sql`SELECT COUNT(*) as total FROM leads WHERE status = ${status}`;
          dataRows = await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        } else if (district) {
          countRows = await sql`SELECT COUNT(*) as total FROM leads WHERE district = ${district}`;
          dataRows = await sql`SELECT * FROM leads WHERE district = ${district} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        } else {
          countRows = await sql`SELECT COUNT(*) as total FROM leads`;
          dataRows = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        }

        const total = parseInt(countRows[0].total);
        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
          success: true,
          leads: dataRows,
          pagination: { page, limit, total, totalPages }
        });
      } catch (error) {
        console.error('List leads error:', error);
        return res.status(500).json({ error: 'Failed to fetch leads', details: error.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }
};
