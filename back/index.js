const http = require('http');
const url = require('url');
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

// ─── VALIDACIONES ───────────────────────────
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

  const end = `${y}-${String(m).padStart(2, '0')}-${String(
    endDate.getDate()
  ).padStart(2, '0')}`;

  return { start, end };
};

// ─── MAPPERS ────────────────────────────────
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

// ─── DB CONNECT ─────────────────────────────
async function initDb() {
  await client.connect();
  console.log('✅ Conectado a PostgreSQL');
}

// ─── MEMBERS ───────────────────────────────
async function getMembers() {
  const result = await client.query(`
    SELECT
      id,
      name,
      color,
      initials,
      sort_order,
      active,
      created_at
    FROM team_members
    ORDER BY sort_order ASC, name ASC
  `);

  return result.rows.map(mapMember);
}

// ─── EVENTS ─────────────────────────────────
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

  const where = clauses.length
    ? `WHERE ${clauses.join(' AND ')}`
    : '';

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
    FROM calendar_events e
    JOIN team_members m
      ON m.id = e.member_id
    ${where}
    ORDER BY e.date ASC, m.sort_order ASC, e.created_at ASC
  `;

  const result = await client.query(query, values);

  return result.rows.map(mapEvent);
}

// ─── CREATE EVENT ───────────────────────────
async function createEvent(payload) {
  const {
    id,
    memberId,
    date,
    tipo,
    departamento = '',
    municipio = '',
    detalle = '',
  } = payload;

  if (!id) throw new Error('id es obligatorio');
  if (!memberId) throw new Error('memberId es obligatorio');
  if (!isValidDate(date)) {
    throw new Error('date debe tener formato YYYY-MM-DD');
  }
  if (!tipo) throw new Error('tipo es obligatorio');

  const result = await client.query(
    `
    INSERT INTO calendar_events (
      id,
      member_id,
      date,
      tipo,
      departamento,
      municipio,
      detalle
    )
    VALUES (
      $1,
      $2,
      $3::date,
      $4,
      $5,
      $6,
      $7
    )
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
    [
      id,
      memberId,
      date,
      tipo,
      departamento,
      municipio,
      detalle,
    ]
  );

  const row = result.rows[0];

  const member = await client.query(
    `
    SELECT
      name AS member_name,
      color AS member_color,
      initials AS member_initials
    FROM team_members
    WHERE id = $1
    `,
    [memberId]
  );

  return mapEvent({
    ...row,
    member_name: member.rows[0]?.member_name,
    member_color: member.rows[0]?.member_color,
    member_initials: member.rows[0]?.member_initials,
  });
}

// ─── UPDATE EVENT ───────────────────────────
async function updateEvent(id, payload) {
  const current = await client.query(
    `SELECT * FROM calendar_events WHERE id = $1`,
    [id]
  );

  if (!current.rows[0]) {
    throw new Error('Evento no encontrado');
  }

  const {
    memberId = current.rows[0].member_id,
    date =
      current.rows[0].date?.toISOString?.().slice(0, 10) ||
      current.rows[0].date,
    tipo = current.rows[0].tipo,
    departamento = current.rows[0].departamento,
    municipio = current.rows[0].municipio,
    detalle = current.rows[0].detalle,
  } = payload;

  if (!memberId) throw new Error('memberId es obligatorio');

  if (!isValidDate(date)) {
    throw new Error('date debe tener formato YYYY-MM-DD');
  }

  if (!tipo) throw new Error('tipo es obligatorio');

  const result = await client.query(
    `
    UPDATE calendar_events
    SET
      member_id = $2,
      date = $3::date,
      tipo = $4,
      departamento = $5,
      municipio = $6,
      detalle = $7
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
    [
      id,
      memberId,
      date,
      tipo,
      departamento,
      municipio,
      detalle,
    ]
  );

  const row = result.rows[0];

  const member = await client.query(
    `
    SELECT
      name AS member_name,
      color AS member_color,
      initials AS member_initials
    FROM team_members
    WHERE id = $1
    `,
    [memberId]
  );

  return mapEvent({
    ...row,
    member_name: member.rows[0]?.member_name,
    member_color: member.rows[0]?.member_color,
    member_initials: member.rows[0]?.member_initials,
  });
}

// ─── DELETE EVENT ───────────────────────────
async function deleteEvent(id) {
  const result = await client.query(
    `DELETE FROM calendar_events WHERE id = $1 RETURNING id`,
    [id]
  );

  return result.rowCount > 0;
}

// ─── SERVER ─────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);

  const path = parsedUrl.pathname || '/';
  const query = parsedUrl.query || {};

  // ROOT
  if (path === '/') {
    return sendJSON(res, 200, {
      servicio: 'Calendario Equipo Social DIH',
      version: '2.0.0',
    });
  }

  // HEALTH
  if (path === '/health') {
    return sendJSON(res, 200, { ok: true });
  }

  // MEMBERS
  if (path === '/members' && req.method === 'GET') {
    try {
      const members = await getMembers();
      return sendJSON(res, 200, members);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // EVENTS
  if (path === '/events' && req.method === 'GET') {
    try {
      const { memberId, year, month, id } = query;

      if (month && !isValidMonth(month)) {
        return sendJSON(res, 400, {
          error: 'month debe estar entre 1 y 12',
        });
      }

      if (year && !isValidYear(year)) {
        return sendJSON(res, 400, {
          error: 'year inválido',
        });
      }

      const events = await getEvents({
        memberId,
        year,
        month,
        id,
      });

      return sendJSON(res, 200, events);
    } catch (err) {
      return sendJSON(res, 500, {
        error: err.message,
      });
    }
  }

  // EVENT DETAIL
  if (path.startsWith('/events/') && req.method === 'GET') {
    const id = path.split('/').filter(Boolean)[1];

    if (!id) {
      return sendJSON(res, 400, {
        error: 'ID inválido',
      });
    }

    try {
      const events = await getEvents({ id });

      if (!events[0]) {
        return sendJSON(res, 404, {
          error: 'Evento no encontrado',
        });
      }

      return sendJSON(res, 200, events[0]);
    } catch (err) {
      return sendJSON(res, 500, {
        error: err.message,
      });
    }
  }

  // CREATE EVENT
  if (path === '/events' && req.method === 'POST') {
    try {
      const body = await readBody(req);

      const created = await createEvent(body);

      return sendJSON(res, 201, created);
    } catch (err) {
      const status =
        /obligatorio|formato/i.test(err.message)
          ? 400
          : 500;

      return sendJSON(res, status, {
        error: err.message,
      });
    }
  }

  // UPDATE EVENT
  if (
    path.startsWith('/events/') &&
    (req.method === 'PUT' || req.method === 'PATCH')
  ) {
    const id = path.split('/').filter(Boolean)[1];

    if (!id) {
      return sendJSON(res, 400, {
        error: 'ID inválido',
      });
    }

    try {
      const body = await readBody(req);

      const updated = await updateEvent(id, body);

      return sendJSON(res, 200, updated);
    } catch (err) {
      const status =
        /no encontrado|obligatorio|formato/i.test(
          err.message
        )
          ? 400
          : 500;

      return sendJSON(res, status, {
        error: err.message,
      });
    }
  }

  // DELETE EVENT
  if (
    path.startsWith('/events/') &&
    req.method === 'DELETE'
  ) {
    const id = path.split('/').filter(Boolean)[1];

    if (!id) {
      return sendJSON(res, 400, {
        error: 'ID inválido',
      });
    }

    try {
      const deleted = await deleteEvent(id);

      if (!deleted) {
        return sendJSON(res, 404, {
          error: 'Evento no encontrado',
        });
      }

      return sendJSON(res, 200, {
        ok: true,
      });
    } catch (err) {
      return sendJSON(res, 500, {
        error: err.message,
      });
    }
  }

  // DOCS
  if (path === '/docs' && req.method === 'GET') {
    return sendText(
      res,
      200,
      `
      <h1>Calendario DIH API</h1>

      <ul>
        <li>GET /members</li>
        <li>GET /events</li>
        <li>POST /events</li>
        <li>PUT /events/:id</li>
        <li>DELETE /events/:id</li>
      </ul>
      `
    );
  }

  return sendJSON(res, 404, {
    error: 'Ruta no existe',
  });
});

// ─── START ──────────────────────────────────
initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(
        `🚀 Servidor corriendo en puerto ${PORT}`
      );
    });
  })
  .catch((err) => {
    console.error('❌ Error DB:', err.message);
    process.exit(1);
  });