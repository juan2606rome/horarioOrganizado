const http = require('http');
const url = require('url');
const { Client } = require('pg');
const { randomUUID } = require('crypto');

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
// AUDIT HELPERS
// ─────────────────────────────────────────────

function generateAuditId() {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isValidAuditType(tipo) {
  return ['AV1', 'AV2', 'AV3'].includes(tipo);
}

function mapAudit(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    memberColor: row.member_color,
    memberInitials: row.member_initials,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    tipo: row.tipo,
    cumplido: row.cumplido,
    detalle: row.detalle || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


async function getAuditEvents({ memberId, year, month } = {}) {
  const values = [];
  const where = [];

  if (memberId) {
    values.push(memberId);
    where.push(`e.member_id = $${values.length}`);
  }

  if (year) {
    values.push(Number(year));
    where.push(`EXTRACT(YEAR FROM e.date) = $${values.length}`);
  }

  if (month) {
    values.push(Number(month));
    where.push(`EXTRACT(MONTH FROM e.date) = $${values.length}`);
  }

  const sql = `
    SELECT
      e.id,
      e.member_id,
      m.name AS member_name,
      m.color AS member_color,
      m.initials AS member_initials,
      e.date,
      e.tipo,
      e.cumplido,
      e.detalle,
      e.created_at,
      e.updated_at
    FROM audit_events e
    JOIN team_members m ON m.id = e.member_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY e.date ASC, e.created_at ASC
  `;

  const result = await client.query(sql, values);
  return result.rows.map(mapAudit);
}

async function getAuditEventById(id) {
  const result = await client.query(
    `
    SELECT
      e.id,
      e.member_id,
      m.name AS member_name,
      m.color AS member_color,
      m.initials AS member_initials,
      e.date,
      e.tipo,
      e.cumplido,
      e.detalle,
      e.created_at,
      e.updated_at
    FROM audit_events e
    JOIN team_members m ON m.id = e.member_id
    WHERE e.id = $1
    `,
    [id]
  );

  return result.rows[0] ? mapAudit(result.rows[0]) : null;
}

async function createAuditEvent(payload) {
  const {
    id,
    memberId,
    date,
    tipo,
    cumplido = false,
    detalle = '',
  } = payload;

  if (!id) throw new Error('id es obligatorio');
  if (!memberId) throw new Error('memberId es obligatorio');
  if (!date || !isValidDate(date)) {
    throw new Error('date debe tener formato YYYY-MM-DD');
  }
  if (!isValidAuditType(tipo)) {
    throw new Error('tipo debe ser AV1, AV2 o AV3');
  }

  const memberCheck = await client.query(
    `SELECT id FROM team_members WHERE id = $1`,
    [memberId]
  );

  if (!memberCheck.rows[0]) {
    throw new Error(`memberId no existe: ${memberId}`);
  }

  await client.query(
    `
    INSERT INTO audit_events (
      id,
      member_id,
      date,
      tipo,
      cumplido,
      detalle
    )
    VALUES ($1, $2, $3::date, $4, $5, $6)
    `,
    [
      id,
      memberId,
      date,
      tipo,
      !!cumplido,
      detalle || '',
    ]
  );

  const created = await getAuditEventById(id);
  if (!created) {
    throw new Error('No se pudo leer el evento recién creado');
  }

  return created;
}

async function updateAuditEvent(id, payload) {
  const current = await client.query(
    `SELECT * FROM audit_events WHERE id = $1`,
    [id]
  );

  if (!current.rows[0]) {
    throw new Error('Auditoría no encontrada');
  }

  const old = current.rows[0];

  const memberId = payload.memberId || old.member_id;
  const date = payload.date || old.date.toISOString().slice(0, 10);
  const tipo = payload.tipo || old.tipo;
  const cumplido =
    payload.cumplido !== undefined ? !!payload.cumplido : old.cumplido;
  const detalle =
    payload.detalle !== undefined ? payload.detalle : old.detalle;

  if (!memberId) throw new Error('memberId es obligatorio');
  if (!isValidDate(date)) {
    throw new Error('date debe tener formato YYYY-MM-DD');
  }
  if (!isValidAuditType(tipo)) {
    throw new Error('tipo debe ser AV1, AV2 o AV3');
  }

  const memberCheck = await client.query(
    `SELECT id FROM team_members WHERE id = $1`,
    [memberId]
  );

  if (!memberCheck.rows[0]) {
    throw new Error(`memberId no existe: ${memberId}`);
  }

  await client.query(
    `
    UPDATE audit_events
    SET
      member_id = $2,
      date = $3::date,
      tipo = $4,
      cumplido = $5,
      detalle = $6
    WHERE id = $1
    `,
    [
      id,
      memberId,
      date,
      tipo,
      cumplido,
      detalle || '',
    ]
  );

  const updated = await getAuditEventById(id);
  if (!updated) {
    throw new Error('No se pudo leer el evento actualizado');
  }

  return updated;
}

async function deleteAuditEvent(id) {
  const result = await client.query(
    `DELETE FROM audit_events WHERE id = $1 RETURNING id`,
    [id]
  );

  return result.rowCount > 0;
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

async function createMember(payload) {
  const {
    id,
    name,
    color = '#2563EB',
    initials = '',
    sortOrder = 999,
    active = true,
  } = payload || {};

  if (!name || !String(name).trim()) {
    throw new Error('name es obligatorio');
  }

  const newId = id || `member_${randomUUID()}`;

  const exists = await client.query(
    `SELECT id FROM team_members WHERE id = $1`,
    [newId]
  );

  if (exists.rows[0]) {
    throw new Error('Ya existe un integrante con ese id');
  }

  await client.query(
    `
    INSERT INTO team_members (
      id,
      name,
      color,
      initials,
      sort_order,
      active
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      newId,
      String(name).trim(),
      color,
      String(initials || '').trim().toUpperCase(),
      Number(sortOrder) || 999,
      Boolean(active),
    ]
  );

  const created = await client.query(
    `
    SELECT
      id,
      name,
      color,
      initials,
      sort_order,
      active,
      created_at
    FROM team_members
    WHERE id = $1
    `,
    [newId]
  );

  return created.rows[0] ? mapMember(created.rows[0]) : null;
}

async function updateMember(id, payload) {
  const current = await client.query(
    `SELECT * FROM team_members WHERE id = $1`,
    [id]
  );

  if (!current.rows[0]) {
    throw new Error('Integrante no encontrado');
  }

  const old = current.rows[0];

  const name =
    payload.name !== undefined ? String(payload.name).trim() : old.name;

  if (!name) {
    throw new Error('name es obligatorio');
  }

  const color = payload.color !== undefined ? payload.color : old.color;
  const initials =
    payload.initials !== undefined
      ? String(payload.initials).trim().toUpperCase()
      : old.initials;
  const sortOrder =
    payload.sortOrder !== undefined ? Number(payload.sortOrder) || 999 : old.sort_order;
  const active =
    payload.active !== undefined ? Boolean(payload.active) : old.active;

  await client.query(
    `
    UPDATE team_members
    SET
      name = $2,
      color = $3,
      initials = $4,
      sort_order = $5,
      active = $6
    WHERE id = $1
    `,
    [id, name, color, initials, sortOrder, active]
  );

  const updated = await client.query(
    `
    SELECT
      id,
      name,
      color,
      initials,
      sort_order,
      active,
      created_at
    FROM team_members
    WHERE id = $1
    `,
    [id]
  );

  return updated.rows[0] ? mapMember(updated.rows[0]) : null;
}

async function deleteMember(id) {
  await client.query('BEGIN');

  try {
    await client.query(
      `DELETE FROM calendar_events WHERE member_id = $1`,
      [id]
    );

    const deleted = await client.query(
      `DELETE FROM team_members WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!deleted.rowCount) {
      throw new Error('Integrante no encontrado');
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
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



// AUDIT EVENTS
if (path === '/audit-events' && req.method === 'GET') {
  const { memberId, year, month } = query;

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

  const audits = await getAuditEvents({
    memberId: memberId || undefined,
    year: year || undefined,
    month: month || undefined,
  });

  return sendJSON(res, 200, audits);
}

if (path === '/audit-events' && req.method === 'POST') {
  const body = await readBody(req);
  const created = await createAuditEvent(body);
  return sendJSON(res, 201, created);
}

if (path.startsWith('/audit-events/') && (req.method === 'PUT' || req.method === 'PATCH')) {
  const id = path.split('/').filter(Boolean)[1];

  if (!id) {
    return sendJSON(res, 400, { error: 'ID inválido' });
  }

  const body = await readBody(req);
  const updated = await updateAuditEvent(id, body);
  return sendJSON(res, 200, updated);
}

if (path.startsWith('/audit-events/') && req.method === 'DELETE') {
  const id = path.split('/').filter(Boolean)[1];

  if (!id) {
    return sendJSON(res, 400, { error: 'ID inválido' });
  }

  const deleted = await deleteAuditEvent(id);
  return sendJSON(res, 200, { ok: deleted });
}





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

    if (path === '/members' && req.method === 'POST') {
      const body = await readBody(req);
      const created = await createMember(body);
      return sendJSON(res, 201, created);
    }

    if (path.startsWith('/members/') && (req.method === 'PUT' || req.method === 'PATCH')) {
      const id = path.split('/').filter(Boolean)[1];

      if (!id) {
        return sendJSON(res, 400, { error: 'ID inválido' });
      }

      const body = await readBody(req);
      const updated = await updateMember(id, body);
      return sendJSON(res, 200, updated);
    }

    if (path.startsWith('/members/') && req.method === 'DELETE') {
      const id = path.split('/').filter(Boolean)[1];

      if (!id) {
        return sendJSON(res, 400, { error: 'ID inválido' });
      }

      const deleted = await deleteMember(id);
      return sendJSON(res, 200, { ok: deleted });
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

    // COMBINED
    if (path === '/combined' && req.method === 'GET') {
      const { year, month, memberId } = query;

      if (!year || !month) {
        return sendJSON(res, 400, {
          error: 'year y month son obligatorios',
        });
      }

      if (!isValidYear(year)) {
        return sendJSON(res, 400, {
          error: 'year inválido',
        });
      }

      if (!isValidMonth(month)) {
        return sendJSON(res, 400, {
          error: 'month debe estar entre 1 y 12',
        });
      }

      const events = await getEvents({
        year,
        month,
        memberId,
      });

      return sendJSON(res, 200, events);
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
            <li>POST /members</li>
            <li>PATCH /members/:id</li>
            <li>DELETE /members/:id</li>
            <li>GET /events</li>
            <li>GET /events/:id</li>
            <li>POST /events</li>
            <li>PUT /events/:id</li>
            <li>DELETE /events/:id</li>
            <li>GET /combined?year=YYYY&month=MM</li>
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