import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Clearing old watch history rows...');
  try {
    const res = await sql`DELETE FROM watch_history;`;
    console.log('Watch history table cleared successfully.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
