const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.DATABASE_URL || '';
if (!url) {
  console.error('DATABASE_URL is empty (is .env loaded?)');
  process.exit(1);
}
try {
  const u = new URL(url);
  console.log('URL format OK');
  console.log('  host:', u.hostname);
  console.log('  port:', u.port);
  console.log('  pathname:', u.pathname);
} catch (e) {
  console.error('Invalid URL:', e.message);
  process.exit(1);
}
