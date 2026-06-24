const { getSQL } = require('../../shared/db');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getSQL();

    // Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'sub_admin',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dropdowns (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        label VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        status VARCHAR(30) DEFAULT 'enquired',
        full_name VARCHAR(255) NOT NULL,
        district VARCHAR(255),
        employee_category VARCHAR(255),
        date_of_birth DATE,
        mobile_no VARCHAR(20),
        alt_mobile_no VARCHAR(20),
        bank_account_no VARCHAR(50),
        ifsc_code VARCHAR(20),
        pan_card_no VARCHAR(10),
        portal_password VARCHAR(255),
        evc_status VARCHAR(50),
        date_of_filing DATE,
        client_since VARCHAR(50),
        rank_designation VARCHAR(255),
        gross_salary NUMERIC(15,2),
        deduction_1 NUMERIC(15,2),
        deduction_2 NUMERIC(15,2),
        refund NUMERIC(15,2),
        total_fee NUMERIC(15,2),
        paid NUMERIC(15,2),
        due NUMERIC(15,2),
        date_of_payment DATE,
        mode_of_payment VARCHAR(100),
        remarks_1 TEXT,
        remarks_2 TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS testimonials (
        id SERIAL PRIMARY KEY,
        client_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        rating INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Check if admin user exists
    const adminRows = await sql`SELECT id FROM users WHERE username = 'admin'`;
    if (adminRows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await sql`INSERT INTO users (username, password_hash, role) VALUES ('admin', ${hash}, 'admin')`;
    }

    // Seed default dropdowns if empty
    const ddRows = await sql`SELECT id FROM dropdowns LIMIT 1`;
    if (ddRows.length === 0) {
      const defaults = [
        { category: 'district', items: ['Visakhapatnam', 'East Godavari', 'West Godavari', 'Krishna', 'Guntur', 'Prakasam', 'Nellore', 'Kadapa', 'Anantapur', 'Kurnool', 'Srikakulam', 'Vizianagaram', 'Chittoor'] },
        { category: 'employee_category', items: ['Police TDS', 'Police Non TDS', 'Excise and SEB', 'Other Professionals'] },
        { category: 'evc_status', items: ['Pending', 'Verified', 'Not Applicable'] },
        { category: 'mode_of_payment', items: ['Cash', 'UPI (Phone Pe/G Pay)', 'Bank Transfer'] },
        { category: 'client_since', items: ['New'] }
      ];

      for (const group of defaults) {
        for (let i = 0; i < group.items.length; i++) {
          await sql`INSERT INTO dropdowns (category, label, sort_order) VALUES (${group.category}, ${group.items[i]}, ${i})`;
        }
      }
    }

    // Seed sample testimonials if empty
    const testRows = await sql`SELECT id FROM testimonials LIMIT 1`;
    if (testRows.length === 0) {
      await sql`INSERT INTO testimonials (client_name, message, rating) VALUES ('Rajesh Kumar', 'Excellent service! Sri Radha Govind & CO made my tax filing process so smooth and hassle-free. Highly recommended!', 5)`;
      await sql`INSERT INTO testimonials (client_name, message, rating) VALUES ('Priya Sharma', 'Very professional team. They handled all my tax requirements with great care and precision. Will definitely come back.', 5)`;
      await sql`INSERT INTO testimonials (client_name, message, rating) VALUES ('Venkat Rao', 'Outstanding support throughout the entire process. Their attention to detail is remarkable. Best tax consultants in the region.', 5)`;
    }

    return res.status(200).json({ success: true, message: 'Database setup complete. Default admin: admin / admin123' });
  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ error: 'Setup failed', details: error.message });
  }
};
