import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { fileURLToPath } from 'url';

// Express server for the React app + database utilities.
// Backup/restore is intentionally performed server-side so it can use the
// PostgreSQL connection securely instead of exposing DATABASE_URL to the browser.
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json({ limit: '200mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;

function requireBackupKey(req, res) {
  const expected = String(process.env.BACKUP_ADMIN_KEY || '');
  if (!expected) {
    res.status(503).json({ message: 'ميزة النسخ الاحتياطي غير مفعلة. أضف BACKUP_ADMIN_KEY إلى .env على السيرفر.' });
    return false;
  }
  if (String(req.headers['x-backup-key'] || '') !== expected) {
    res.status(401).json({ message: 'مفتاح النسخ الاحتياطي غير صحيح.' });
    return false;
  }
  return true;
}

async function getPublicTables(client = pool) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function getTableColumns(client, table) {
  const { rows } = await client.query(`
    SELECT column_name, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table]);
  return rows.map((r) => r.column_name);
}

// مسار الاختبار
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students LIMIT 1');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error_message: err.message, error_code: err.code });
  }
});

// مسار تسجيل الدخول القديم (يبقى للتوافق مع النسخ السابقة)
app.post('/api/login', async (req, res) => {
  const { seating_number, password } = req.body;
  if (!seating_number || !password) return res.status(400).json({ message: 'يرجى إدخال رقم الجلوس وكلمة المرور' });
  try {
    const result = await pool.query('SELECT * FROM students WHERE seating_number = $1', [seating_number]);
    if (!result.rows.length) return res.status(404).json({ message: 'رقم الجلوس غير موجود' });
    const student = result.rows[0];
    const passwordResult = await pool.query(
      'SELECT ($1 = crypt($2, $1)) AS valid',
      [student.password_hash, password]
    );
    if (!passwordResult.rows[0]?.valid) return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    const { password_hash, ...studentData } = student;
    res.json({ message: 'تم تسجيل الدخول بنجاح', student: studentData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'حدث خطأ في السيرفر', error: err.message });
  }
});

app.get('/api/questions/:branchId', async (req, res) => {
  const { branchId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM questions WHERE branch_id = $1', [branchId]);
    if (!result.rows.length) return res.status(404).json({ message: 'لا توجد أسئلة مضافة لهذا الفرع' });
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch questions error:', err);
    res.status(500).json({ message: 'حدث خطأ في جلب الأسئلة', error: err.message });
  }
});

app.post('/api/submit', async (req, res) => {
  const { student_id, exam_id, score } = req.body;
  if (!student_id || score === undefined) return res.status(400).json({ message: 'يرجى إرسال رقم الطالب والنتيجة' });
  try {
    const result = await pool.query(
      'INSERT INTO submissions (student_id, exam_id, score) VALUES ($1, $2, $3) RETURNING *',
      [student_id, exam_id || 1, score]
    );
    res.json({ message: 'تم حفظ نتيجة الامتحان بنجاح', submission: result.rows[0] });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء حفظ النتيجة', error: err.message });
  }
});

// =========================================================
// FULL DATABASE BACKUP / RESTORE
// =========================================================
async function getSchemaSnapshot(client) {
  const tables = await getPublicTables(client);
  const columns = {};
  const primaryKeys = {};
  const foreignKeys = {};
  const indexes = {};
  const sequences = {};
  const policies = {};
  const triggers = {};
  const functions = [];
  const views = [];

  for (const table of tables) {
    const colResult = await client.query(`
      SELECT column_name, data_type, udt_schema, udt_name, is_nullable,
             column_default, character_maximum_length, numeric_precision,
             numeric_scale, ordinal_position
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position
    `, [table]);
    columns[table] = colResult.rows;

    const pk = await client.query(`
      SELECT kcu.column_name, kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [table]);
    primaryKeys[table] = pk.rows;

    const fk = await client.query(`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name=$1
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `, [table]);
    foreignKeys[table] = fk.rows;

    const idx = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname='public' AND tablename=$1
      ORDER BY indexname
    `, [table]);
    indexes[table] = idx.rows;

    const seq = await client.query(`
      SELECT c.relname AS sequence_name, pg_get_serial_sequence($1, a.attname) AS sequence_ref,
             a.attname AS column_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = pg_get_serial_sequence($1, a.attname)::regclass
      WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped
    `, [`public.${table}`]).catch(() => ({ rows: [] }));
    sequences[table] = seq.rows;

    const pol = await client.query(`
      SELECT pol.polname,
             CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissiveness,
             CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END AS command,
             pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
             pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expression,
             COALESCE(array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid=ANY(pol.polroles)), ', '), 'public') AS roles
      FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid
      WHERE c.relnamespace='public'::regnamespace AND c.relname=$1
      ORDER BY pol.polname
    `, [table]);
    policies[table] = pol.rows;

    const trg = await client.query(`
      SELECT tgname, pg_get_triggerdef(oid, true) AS definition
      FROM pg_trigger
      WHERE tgrelid=$1::regclass AND NOT tgisinternal
      ORDER BY tgname
    `, [`public.${table}`]).catch(() => ({ rows: [] }));
    triggers[table] = trg.rows;
  }

  const fn = await client.query(`
    SELECT n.nspname AS schema_name, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
    ORDER BY p.proname, identity_arguments
  `);
  functions.push(...fn.rows);

  const vw = await client.query(`
    SELECT table_name AS name,
           'CREATE OR REPLACE VIEW ' || quote_ident(table_schema) || '.' || quote_ident(table_name) || ' AS ' ||
           pg_get_viewdef(format('%I.%I', table_schema, table_name)::regclass, true) || ';' AS definition
    FROM information_schema.views
    WHERE table_schema='public'
    ORDER BY table_name
  `);
  views.push(...vw.rows);

  return { tables, columns, primaryKeys, foreignKeys, indexes, sequences, policies, triggers, functions, views };
}

async function exportBackup(client) {
  const schema = await getSchemaSnapshot(client);
  const data = {};
  for (const table of schema.tables) {
    const result = await client.query(`SELECT * FROM ${quoteIdent(table)}`);
    data[table] = result.rows;
  }
  const sequenceValues = {};
  for (const table of schema.tables) {
    sequenceValues[table] = [];
    for (const seq of schema.sequences[table] || []) {
      if (!seq.sequence_ref) continue;
      try {
        const q = await client.query(`SELECT last_value, is_called FROM ${seq.sequence_ref}`);
        sequenceValues[table].push({ ...seq, ...q.rows[0] });
      } catch {}
    }
  }
  return {
    format: 'project06-postgres-full-backup',
    version: 2,
    created_at: new Date().toISOString(),
    database: 'PostgreSQL',
    schema,
    data,
    sequence_values: sequenceValues
  };
}

app.get('/api/backup/export', async (req, res) => {
  if (!requireBackupKey(req, res)) return;
  const client = await pool.connect();
  try {
    const backup = await exportBackup(client);
    const compressed = gzipSync(Buffer.from(JSON.stringify(backup), 'utf8'), { level: 9 });
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="Project06-Full-Backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz"`);
    res.setHeader('X-Backup-Format', 'project06-postgres-full-backup-v2');
    res.end(compressed);
  } catch (err) {
    console.error('Backup export error:', err);
    res.status(500).json({ message: 'فشل إنشاء النسخة الاحتياطية الكاملة', error: err.message });
  } finally { client.release(); }
});

async function restoreBackup(client, backup) {
  if (!backup || !['project06-postgres-full-backup', 'project06-postgres-json-backup'].includes(backup.format) || !backup.data) {
    throw new Error('ملف النسخة الاحتياطية غير صالح أو من إصدار غير مدعوم.');
  }
  await client.query('BEGIN');
  try {
    const currentTables = await getPublicTables(client);
    const backupTables = Object.keys(backup.data).filter((t) => currentTables.includes(t));
    if (!backupTables.length) throw new Error('لا توجد جداول مشتركة قابلة للاسترجاع.');

    // Restore is data-first and transactional. CASCADE clears dependent rows safely.
    await client.query(`TRUNCATE TABLE ${backupTables.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE`);

    const pending = backupTables.map(table => ({ table, rows: Array.isArray(backup.data[table]) ? backup.data[table] : [] }));
    let safety = pending.length + 5;
    while (pending.length && safety-- > 0) {
      let progressed = false;
      for (let i=pending.length-1; i>=0; i--) {
        const item=pending[i];
        if (!item.rows.length) { pending.splice(i,1); progressed=true; continue; }
        try {
          const cols = await getTableColumns(client, item.table);
          const keys = cols.filter(c => Object.prototype.hasOwnProperty.call(item.rows[0], c));
          if (!keys.length) { pending.splice(i,1); progressed=true; continue; }
          const values=[];
          const tuples=item.rows.map(row=>{
            const vals=keys.map(k=>row[k]); const start=values.length; values.push(...vals);
            return `(${vals.map((_,idx)=>`$${start+idx+1}`).join(', ')})`;
          });
          await client.query(`INSERT INTO ${quoteIdent(item.table)} (${keys.map(quoteIdent).join(', ')}) VALUES ${tuples.join(', ')}`, values);
          pending.splice(i,1); progressed=true;
        } catch(err) {
          if (!/foreign key|violates.*constraint|referenced/i.test(String(err.message))) throw err;
        }
      }
      if (!progressed) throw new Error(`تعذر استرجاع بعض الجداول بسبب علاقات قاعدة البيانات: ${pending.map(x=>x.table).join(', ')}`);
    }

    // Restore sequence counters where the sequence still exists.
    for (const [table, seqs] of Object.entries(backup.sequence_values || {})) {
      for (const seq of seqs || []) {
        if (!seq.sequence_ref || seq.last_value == null) continue;
        try {
          await client.query(`SELECT setval($1::regclass, $2, $3)`, [seq.sequence_ref, seq.last_value, Boolean(seq.is_called)]);
        } catch {}
      }
    }

    await client.query('COMMIT');
    return { restoredTables: backupTables, restoredSchemaMetadata: Boolean(backup.schema), version: backup.version || 1 };
  } catch(err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

app.post('/api/backup/restore', async (req, res) => {
  if (!requireBackupKey(req, res)) return;
  const backup = req.body?.backup;
  const client = await pool.connect();
  try {
    const result = await restoreBackup(client, backup);
    res.json({ message: 'تم استرجاع النسخة الاحتياطية بنجاح.', ...result });
  } catch (err) {
    console.error('Backup restore error:', err);
    res.status(500).json({ message: 'فشل استرجاع النسخة الاحتياطية', error: err.message });
  } finally { client.release(); }
});

app.post('/api/backup/restore-gzip', express.raw({ type: ['application/gzip', 'application/octet-stream'], limit: '300mb' }), async (req, res) => {
  if (!requireBackupKey(req, res)) return;
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body?.data_base64 || '', 'base64');
  if (!raw.length) return res.status(400).json({ message: 'ملف النسخة الاحتياطية فارغ.' });
  const client = await pool.connect();
  try {
    const json = gunzipSync(raw).toString('utf8');
    const backup = JSON.parse(json);
    const result = await restoreBackup(client, backup);
    res.json({ message: 'تم استرجاع النسخة الاحتياطية الكاملة بنجاح.', ...result });
  } catch (err) {
    console.error('Compressed restore error:', err);
    res.status(500).json({ message: 'فشل استرجاع النسخة الاحتياطية المضغوطة', error: err.message });
  } finally { client.release(); }
});


// خدمة نسخة Vite المبنية عند تشغيل node server.js
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
