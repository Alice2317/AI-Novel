import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pg from 'pg';

type Database = Pick<pg.Pool, 'query'>;
const columns = `id, title, genre, status, summary, original_mode AS "originalMode",
  story_language AS "storyLanguage", version, created_at AS "createdAt", updated_at AS "updatedAt"`;

class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function respond(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(data));
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Expected application/json');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  const stream = request.iterator({ destroyOnReturn: false });
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > 64 * 1024) {
      request.resume();
      throw new RequestError(413, 'Request body is too large');
    }
    chunks.push(chunk);
  }

  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Invalid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestError(400, 'Expected a JSON object');
  }
  return body as Record<string, unknown>;
}

function textField(value: unknown, name: string, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || (required && !value.trim())) {
    throw new RequestError(400, 'Invalid ' + name);
  }
  return value;
}

function storyValues(body: Record<string, unknown>, creating: boolean) {
  const { title, genre, status, summary, originalMode, storyLanguage } = creating
    ? { genre: '', status: '草稿', summary: '', originalMode: 'none', storyLanguage: 'zh-TW', ...body }
    : body;
  if (originalMode !== 'none' && originalMode !== 'active' && originalMode !== 'reference') {
    throw new RequestError(400, 'Invalid originalMode');
  }
  if (storyLanguage !== 'zh-TW' && storyLanguage !== 'en') {
    throw new RequestError(400, 'Invalid storyLanguage');
  }
  return [
    textField(title, 'title', 60, true).trim(), textField(genre, 'genre', 40),
    textField(status, 'status', 40, true), textField(summary, 'summary', 10000),
    originalMode, storyLanguage,
  ];
}

export function createStoryServer(db: Database) {
  return createServer(async (request, response) => {
    try {
      const path = request.url?.split('?')[0];
      const method = request.method;
      if (path === '/api/stories' && method === 'GET') {
        const result = await db.query(`SELECT ${columns} FROM stories ORDER BY updated_at DESC, id`);
        return respond(response, 200, result.rows);
      }
      if (path === '/api/stories' && method === 'POST') {
        const values = storyValues(await readBody(request), true);
        const id = randomUUID();
        const result = await db.query(
          `INSERT INTO stories (id, title, genre, status, summary, original_mode, story_language)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`, [id, ...values],
        );
        response.setHeader('Location', '/api/stories/' + id);
        return respond(response, 201, result.rows[0]);
      }

      const chatStoryId = path?.match(/^\/api\/stories\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/chat$/i)?.[1];
      if (chatStoryId && (method === 'GET' || method === 'POST')) {
        const story = (await db.query('SELECT story_language FROM stories WHERE id=$1', [chatStoryId])).rows[0];
        if (!story) throw new RequestError(404, 'Story not found');
        if (method === 'GET') {
          const { rows } = await db.query(
            'SELECT player_text AS "playerText", reply_text AS reply FROM story_chat_exchanges WHERE story_id=$1 ORDER BY id',
            [chatStoryId],
          );
          return respond(response, 200, rows);
        }
        const body = await readBody(request);
        const playerText = textField(body.text, 'text', 5000, true).trim();
        const requestId = body.requestId;
        if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
          throw new RequestError(400, 'Invalid requestId');
        }
        const publicText = playerText.split(/\r?\n/).filter(line => !/^\s*OS(?:\s|[:：]|$)/i.test(line)).join('\n').trim();
        const heardKnock = /敲門|敲门|knock/i.test(publicText);
        const reply = story.story_language === 'en'
          ? heardKnock ? 'Lin Che: Keep the door closed. Can you see anyone through the peephole?' : 'Lin Che: I’m still here. Can you hear anything outside your door?'
          : heardKnock ? '林澈：先別開門。你能從貓眼看見外面有人嗎？' : '林澈：我還在。你聽得見門外有什麼聲音嗎？';
        const { rows } = await db.query(
          `INSERT INTO story_chat_exchanges (story_id, request_id, player_text, reply_text)
           VALUES ($1,$2,$3,$4) ON CONFLICT (story_id, request_id) DO UPDATE
           SET request_id=EXCLUDED.request_id RETURNING player_text AS "playerText", reply_text AS reply`,
          [chatStoryId, requestId, playerText, reply],
        );
        if (rows[0].playerText !== playerText) throw new RequestError(409, 'Request ID already used');
        return respond(response, 200, rows[0]);
      }

      const id = path?.match(/^\/api\/stories\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
      if (id && method === 'GET') {
        const result = await db.query(`SELECT ${columns} FROM stories WHERE id=$1`, [id]);
        if (result.rows[0]) return respond(response, 200, result.rows[0]);
      }
      if (id && (method === 'PUT' || method === 'DELETE')) {
        const body = await readBody(request);
        const { version } = body;
        if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 2147483647) {
          throw new RequestError(400, 'Invalid version');
        }
        if (method === 'DELETE') {
          const result = await db.query('DELETE FROM stories WHERE id=$1 AND version=$2 RETURNING id', [id, version]);
          if (result.rows[0]) return respond(response, 200, result.rows[0]);
          const existing = await db.query('SELECT 1 FROM stories WHERE id=$1', [id]);
          if (existing.rows.length) throw new RequestError(409, 'Story changed. Reload before deleting again.');
          return respond(response, 404, { error: 'Not found' });
        }
        const values = storyValues(body, false);
        const result = await db.query(
          `UPDATE stories SET title=$2, genre=$3, status=$4, summary=$5, original_mode=$6,
             story_language=$7, updated_at=now(), version=version+1
           WHERE id=$1 AND version=$8 RETURNING ${columns}`, [id, ...values, version],
        );
        if (result.rows[0]) return respond(response, 200, result.rows[0]);
        const existing = await db.query('SELECT 1 FROM stories WHERE id=$1', [id]);
        if (existing.rows.length) throw new RequestError(409, 'Story changed. Reload before saving again.');
      }
      respond(response, 404, { error: 'Not found' });
    } catch (error) {
      if (error instanceof RequestError) return respond(response, error.status, { error: error.message });
      console.error('Story request failed', error);
      respond(response, 500, { error: 'Story request failed' });
    }
  });
}

if (import.meta.main) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env');
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    createStoryServer(db).listen(port, '127.0.0.1', () => {
      console.log('Story API listening at http://127.0.0.1:' + port);
    });
  } catch (error) {
    await db.end();
    throw error;
  }
}
