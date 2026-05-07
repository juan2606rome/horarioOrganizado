const http = require('http');
const url = require('url');
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// ─── CONEXIÓN DB ─────────────────────────────
const client = new Client(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: 'localhost',
        port: 5432,
        database: 'pokemon_db',
        user: 'postgres',
        password: '1234',
      }
);

// ─── CORS ───────────────────────────────────
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const sendJSON = (res, status, data) => {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const sendText = (res, status, html) => {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Body demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidMonth = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12;
};
const isValidYear = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
};

const rangeForMonth = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = new Date(y, m, 0);
  const end = `${y}-${String(m).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end };
};

const mapMember = (row) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  initials: row.initials,
  sortOrder: row.sort_order,
  active: row.active,
  createdAt: row.created_at,
});

const mapEvent = (row) => ({
  id: row.id,
  memberId: row.member_id,
  memberName: row.member_name,
  memberColor: row.member_color,
  memberInitials: row.member_initials,
  date: row.date,
  tipo: row.tipo,
  departamento: row.departamento,
  municipio: row.municipio,
  detalle: row.detalle,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function initDb() {
  await client.connect();
  console.log('✅ Conectado a PostgreSQL');

  // No obliga a usar esta parte si ya corriste el SQL en Supabase,
  // pero ayuda a que el servicio arranque sin tablas faltantes.
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS public.team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      initials TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id TEXT NOT NULL REFERENCES public.team_members(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      date DATE NOT NULL,
      tipo TEXT NOT NULL,
      departamento TEXT NOT NULL DEFAULT '',
      municipio TEXT NOT NULL DEFAULT '',
      detalle TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_events_member_date ON public.calendar_events (member_id, date);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events (date);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_tipo ON public.calendar_events (tipo);

    CREATE OR REPLACE VIEW public.calendar_events_with_member AS
    SELECT
      e.*,
      m.name AS member_name,
      m.color AS member_color,
      m.initials AS member_initials
    FROM public.calendar_events e
    JOIN public.team_members m ON m.id = e.member_id;
  `);
}

async function getMembers() {
  const result = await client.query(`
    SELECT id, name, color, initials, sort_order, active, created_at
    FROM public.team_members
    ORDER BY sort_order ASC, name ASC
  `);
  return result.rows.map(mapMember);
}

async function getEvents(filters = {}) {
  const { memberId, year, month, id } = filters;
  const clauses = [];
  const values = [];
  let idx = 1;

  if (id) {
    clauses.push(`e.id = $${idx++}`);
    values.push(id);
  }

  if (memberId) {
    clauses.push(`e.member_id = $${idx++}`);
    values.push(memberId);
  }

  if (year && month) {
    const { start, end } = rangeForMonth(year, month);
    clauses.push(`e.date BETWEEN $${idx++} AND $${idx++}`);
    values.push(start, end);
  } else if (year) {
    clauses.push(`EXTRACT(YEAR FROM e.date) = $${idx++}`);
    values.push(Number(year));
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const query = `
    SELECT
      e.id,
      e.member_id,
      e.date::text AS date,
      e.tipo,
      e.departamento,
      e.municipio,
      e.detalle,
      e.created_at,
      e.updated_at,
      m.name AS member_name,
      m.color AS member_color,
      m.initials AS member_initials
    FROM public.calendar_events e
    JOIN public.team_members m ON m.id = e.member_id
    ${where}
    ORDER BY e.date ASC, m.sort_order ASC, e.created_at ASC
  `;

  const result = await client.query(query, values);
  return result.rows.map(mapEvent);
}

async function createEvent(payload) {
  const {
    memberId,
    date,
    tipo,
    departamento = '',
    municipio = '',
    detalle = '',
  } = payload;

  if (!memberId) throw new Error('memberId es obligatorio');
  if (!isValidDate(date)) throw new Error('date debe tener formato YYYY-MM-DD');
  if (!tipo) throw new Error('tipo es obligatorio');

  const id = randomUUID();

  const result = await client.query(
    `
    INSERT INTO public.calendar_events
      (id, member_id, date, tipo, departamento, municipio, detalle, created_at, updated_at)
    VALUES
      ($1, $2, $3::date, $4, $5, $6, $7, NOW(), NOW())
    RETURNING
      id,
      member_id,
      date::text AS date,
      tipo,
      departamento,
      municipio,
      detalle,
      created_at,
      updated_at
    `,
    [id, memberId, date, tipo, departamento, municipio, detalle]
  );

  const row = result.rows[0];
  const member = await client.query(
    `SELECT name AS member_name, color AS member_color, initials AS member_initials FROM public.team_members WHERE id = $1`,
    [memberId]
  );

  return mapEvent({
    ...row,
    member_name: member.rows[0]?.member_name,
    member_color: member.rows[0]?.member_color,
    member_initials: member.rows[0]?.member_initials,
  });
}

async function updateEvent(id, payload) {
  const current = await client.query(`SELECT * FROM public.calendar_events WHERE id = $1`, [id]);
  if (!current.rows[0]) throw new Error('Evento no encontrado');

  const {
    memberId = current.rows[0].member_id,
    date = current.rows[0].date?.toISOString?.().slice(0, 10) || current.rows[0].date,
    tipo = current.rows[0].tipo,
    departamento = current.rows[0].departamento,
    municipio = current.rows[0].municipio,
    detalle = current.rows[0].detalle,
  } = payload;

  if (!memberId) throw new Error('memberId es obligatorio');
  if (!isValidDate(date)) throw new Error('date debe tener formato YYYY-MM-DD');
  if (!tipo) throw new Error('tipo es obligatorio');

  const result = await client.query(
    `
    UPDATE public.calendar_events
    SET
      member_id = $2,
      date = $3::date,
      tipo = $4,
      departamento = $5,
      municipio = $6,
      detalle = $7,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      member_id,
      date::text AS date,
      tipo,
      departamento,
      municipio,
      detalle,
      created_at,
      updated_at
    `,
    [id, memberId, date, tipo, departamento, municipio, detalle]
  );

  const row = result.rows[0];
  const member = await client.query(
    `SELECT name AS member_name, color AS member_color, initials AS member_initials FROM public.team_members WHERE id = $1`,
    [memberId]
  );

  return mapEvent({
    ...row,
    member_name: member.rows[0]?.member_name,
    member_color: member.rows[0]?.member_color,
    member_initials: member.rows[0]?.member_initials,
  });
}

async function deleteEvent(id) {
  const result = await client.query(
    `DELETE FROM public.calendar_events WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount > 0;
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname || '/';
  const query = parsedUrl.query || {};

  // ─── ROOT ─────────────────────────────────
  if (path === '/') {
    return sendJSON(res, 200, {
      servicio: 'Calendario Equipo Social DIH',
      version: '2.0.0',
      endpoints: {
        members: '/members',
        events: '/events',
        eventById: '/events/:id',
        combined: '/combined?year=2026&month=4',
        docs: '/docs',
      },
    });
  }

  // ─── HEALTH ───────────────────────────────
  if (path === '/health') {
    return sendJSON(res, 200, { ok: true });
  }

  // ─── MEMBERS ──────────────────────────────
  if (path === '/members' && req.method === 'GET') {
    try {
      const members = await getMembers();
      return sendJSON(res, 200, members);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ─── EVENTS LIST / FILTERS ────────────────
  if (path === '/events' && req.method === 'GET') {
    try {
      const { memberId, year, month, id } = query;
      if (month && !isValidMonth(month)) {
        return sendJSON(res, 400, { error: 'month debe estar entre 1 y 12' });
      }
      if (year && !isValidYear(year)) {
        return sendJSON(res, 400, { error: 'year inválido' });
      }

      const events = await getEvents({ memberId, year, month, id });
      return sendJSON(res, 200, events);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ─── COMBINED VIEW ────────────────────────
  if (path === '/combined' && req.method === 'GET') {
    try {
      const { year, month } = query;
      if (!month || !year) {
        return sendJSON(res, 400, { error: 'year y month son obligatorios' });
      }
      if (!isValidMonth(month)) {
        return sendJSON(res, 400, { error: 'month debe estar entre 1 y 12' });
      }
      if (!isValidYear(year)) {
        return sendJSON(res, 400, { error: 'year inválido' });
      }

      const events = await getEvents({ year, month });
      return sendJSON(res, 200, events);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ─── EVENT DETAIL ─────────────────────────
  if (path.startsWith('/events/') && req.method === 'GET') {
    const id = path.split('/').filter(Boolean)[1];
    if (!id) return sendJSON(res, 400, { error: 'ID inválido' });

    try {
      const events = await getEvents({ id });
      if (!events[0]) return sendJSON(res, 404, { error: 'Evento no encontrado' });
      return sendJSON(res, 200, events[0]);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ─── CREATE EVENT ─────────────────────────
  if (path === '/events' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const created = await createEvent(body);
      return sendJSON(res, 201, created);
    } catch (err) {
      const status = /obligatorio|formato/i.test(err.message) ? 400 : 500;
      return sendJSON(res, status, { error: err.message });
    }
  }

  // ─── UPDATE EVENT ─────────────────────────
  if (path.startsWith('/events/') && (req.method === 'PUT' || req.method === 'PATCH')) {
    const id = path.split('/').filter(Boolean)[1];
    if (!id) return sendJSON(res, 400, { error: 'ID inválido' });

    try {
      const body = await readBody(req);
      const updated = await updateEvent(id, body);
      return sendJSON(res, 200, updated);
    } catch (err) {
      const status = /no encontrado|obligatorio|formato/i.test(err.message) ? 400 : 500;
      return sendJSON(res, status, { error: err.message });
    }
  }

  // ─── DELETE EVENT ─────────────────────────
  if (path.startsWith('/events/') && req.method === 'DELETE') {
    const id = path.split('/').filter(Boolean)[1];
    if (!id) return sendJSON(res, 400, { error: 'ID inválido' });

    try {
      const deleted = await deleteEvent(id);
      if (!deleted) return sendJSON(res, 404, { error: 'Evento no encontrado' });
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ─── DOCS BÁSICOS ─────────────────────────
  if (path === '/docs' && req.method === 'GET') {
    return sendText(
      res,
      200,
      `<!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Calendario DIH API</title>
          <style>
            body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;line-height:1.5}
            code{background:#f4f4f4;padding:2px 6px;border-radius:6px}
          </style>
        </head>
        <body>
          <h1>Calendario DIH API</h1>
          <p>Rutas:</p>
          <ul>
            <li><code>GET /members</code></li>
            <li><code>GET /events?memberId=&year=&month=</code></li>
            <li><code>GET /combined?year=&month=</code></li>
            <li><code>POST /events</code></li>
            <li><code>PUT /events/:id</code></li>
            <li><code>DELETE /events/:id</code></li>
          </ul>
        </body>
      </html>`
    );
  }

  return sendJSON(res, 404, { error: 'Ruta no existe' });
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
      console.log(`📚 Docs en http://localhost:${PORT}/docs`);
    });
  })
  .catch((err) => {
    console.error('❌ Error DB:', err.message);
    process.exit(1);
  });
