const { neon } = require('@neondatabase/serverless');

function getSQL() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error('DATABASE_URL or POSTGRES_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

module.exports = { getSQL };
