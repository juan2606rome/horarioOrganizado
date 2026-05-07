const http = require('http');
const url = require('url');
const { Client } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// CONEXIÓN DB
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// UTILIDADES HTTP
// ─────────────────────────────────────────────
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
};

const sendJSON = (res, status, data) => {
  setCorsHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
};

const sendText = (res, status, html) => {
  setCorsHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
  });
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
      } catch {
        reject(new Error('JSON inválido'));
      }
    });

    req.on('error', reject);
  });

// ─────────────────────────────────────────────
// VALIDACIONES
// ─────────────────────────────────────────────
const isValidDate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
};

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

// ─────────────────────────────────────────────
// MAPPERS
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// DB INIT
// ─────────────────────────────────────────────
async function initDb() {
  await client.connect();
  console.log('✅ Conectado a PostgreSQL');
}

// ─────────────────────────────────────────────
// HELPERS DB
// ─────────────────────────────────────────────
async function getEventById(id) {
  const result = await client.query(
    `
    SELECT
      id,
      member_id,
      member_name,
      member_color,
      member_initials,
      date::text AS date,
      tipo,
      departamento,
      municipio,
      detalle,
      created_at,
      updated_at
    FROM calendar_events_with_member
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ? mapEvent(result.rows[0]) : null;
}

async function getEvents(filters = {}) {
  const { memberId, year, month, id } = filters;

  const clauses = [];
  const values = [];
  let idx = 1;

  if (id) {
    clauses.push(`id = $${idx++}`);
    values.push(id);
  }

  if (memberId) {
    clauses.push(`member_id = $${idx++}`);
    values.push(memberId);
  }

  if (year && month) {
    const { start, end } = rangeForMonth(year, month);
    clauses.push(`date BETWEEN $${idx++}::date AND $${idx++}::date`);
    values.push(start, end);
  } else if (year) {
    clauses.push(`EXTRACT(YEAR FROM date) = $${idx++}`);
    values.push(Number(year));
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      member_id,
      member_name,
      member_color,
      member_initials,
      date::text AS date,
      tipo,
      departamento,
      municipio,
      detalle,
      created_at,
      updated_at
    FROM calendar_events_with_member
    ${where}
    ORDER BY date ASC, member_name ASC, created_at ASC
  `;

  const result = await client.query(query, values);
  return result.rows.map(mapEvent);
}

// ─────────────────────────────────────────────
// MEMBERS
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// CREATE EVENT
// ─────────────────────────────────────────────
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
  if (!date || !isValidDate(date)) {
    throw new Error('date debe tener formato YYYY-MM-DD');
  }
  if (!tipo) throw new Error('tipo es obligatorio');

  // valida que el miembro exista antes del INSERT
  const memberCheck = await client.query(
    `SELECT id FROM team_members WHERE id = $1`,
    [memberId]
  );

  if (!memberCheck.rows[0]) {
    throw new Error(`memberId no existe: ${memberId}`);
  }

  await client.query(
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
    `,
    [
      id,
      memberId,
      date,
      tipo,
      departamento || '',
      municipio || '',
      detalle || '',
    ]
  );

  const created = await getEventById(id);
  if (!created) {
    throw new Error('No se pudo leer el evento recién creado');
  }

  return created;
}

// ─────────────────────────────────────────────
// UPDATE EVENT
// ─────────────────────────────────────────────
async function updateEvent(id, payload) {
  const current = await client.query(
    `SELECT * FROM calendar_events WHERE id = $1`,
    [id]
  );

  if (!current.rows[0]) {
    throw new Error('Evento no encontrado');
  }

  const old = current.rows[0];

  const memberId = payload.memberId || old.member_id;
  const date = payload.date || old.date.toISOString().slice(0, 10);
  const tipo = payload.tipo || old.tipo;
  const departamento =
    payload.departamento !== undefined
      ? payload.departamento
      : old.departamento;
  const municipio =
    payload.municipio !== undefined ? payload.municipio : old.municipio;
  const detalle =
    payload.detalle !== undefined ? payload.detalle : old.detalle;

  if (!memberId) throw new Error('memberId es obligatorio');
  if (!isValidDate(date)) {
    throw new Error('date debe tener formato YYYY-MM-DD');
  }
  if (!tipo) throw new Error('tipo es obligatorio');

  const memberCheck = await client.query(
    `SELECT id FROM team_members WHERE id = $1`,
    [memberId]
  );

  if (!memberCheck.rows[0]) {
    throw new Error(`memberId no existe: ${memberId}`);
  }

  await client.query(
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
    `,
    [
      id,
      memberId,
      date,
      tipo,
      departamento || '',
      municipio || '',
      detalle || '',
    ]
  );

  const updated = await getEventById(id);
  if (!updated) {
    throw new Error('No se pudo leer el evento actualizado');
  }

  return updated;
}

// ─────────────────────────────────────────────
// DELETE EVENT
// ─────────────────────────────────────────────
async function deleteEvent(id) {
  const result = await client.query(
    `DELETE FROM calendar_events WHERE id = $1 RETURNING id`,
    [id]
  );

  return result.rowCount > 0;
}

// ─────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname || '/';
  const query = parsedUrl.query || {};

  try {
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
      const members = await getMembers();
      return sendJSON(res, 200, members);
    }

    // GET EVENTS
    if (path === '/events' && req.method === 'GET') {
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
    }

    // GET EVENT DETAIL
    if (path.startsWith('/events/') && req.method === 'GET') {
      const id = path.split('/').filter(Boolean)[1];

      if (!id) {
        return sendJSON(res, 400, { error: 'ID inválido' });
      }

      const event = await getEventById(id);

      if (!event) {
        return sendJSON(res, 404, { error: 'Evento no encontrado' });
      }

      return sendJSON(res, 200, event);
    }

    // CREATE EVENT
    if (path === '/events' && req.method === 'POST') {
      const body = await readBody(req);
      const created = await createEvent(body);
      return sendJSON(res, 201, created);
    }

    // UPDATE EVENT
    if (
      path.startsWith('/events/') &&
      (req.method === 'PUT' || req.method === 'PATCH')
    ) {
      const id = path.split('/').filter(Boolean)[1];

      if (!id) {
        return sendJSON(res, 400, { error: 'ID inválido' });
      }

      const body = await readBody(req);
      const updated = await updateEvent(id, body);
      return sendJSON(res, 200, updated);
    }

    // DELETE EVENT
    if (path.startsWith('/events/') && req.method === 'DELETE') {
      const id = path.split('/').filter(Boolean)[1];

      if (!id) {
        return sendJSON(res, 400, { error: 'ID inválido' });
      }

      const deleted = await deleteEvent(id);

      if (!deleted) {
        return sendJSON(res, 404, { error: 'Evento no encontrado' });
      }

      return sendJSON(res, 200, { ok: true });
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
            <li>GET /events/:id</li>
            <li>POST /events</li>
            <li>PUT /events/:id</li>
            <li>DELETE /events/:id</li>
          </ul>
        `
      );
    }

    return sendJSON(res, 404, { error: 'Ruta no existe' });
  } catch (err) {
    console.error('❌ ERROR EN SERVIDOR:', err);

    return sendJSON(res, 500, {
      error: err.message || 'Error interno del servidor',
    });
  }
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error DB:', err.message);
    process.exit(1);
  });