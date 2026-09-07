import { pool } from './dist/db.js';
import bcrypt from 'bcryptjs';

async function test() {
  try {
    const { rows } = await pool.query("SELECT id, username FROM users LIMIT 1");
    const user = rows[0];
    console.log('Testing reset on user:', user.username, user.id);
    const hash = await bcrypt.hash('TestPass123', 10);
    const updateRes = await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = TRUE, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [hash, user.id]
    );
    console.log('Update result:', updateRes.rows);
  } catch (e) {
    console.error('ERROR during reset:', e);
  } finally {
    pool.end();
  }
}
test();
