/**
 * /api/reviews —— 评论接口（Cloudflare Pages Function）
 *
 * 作用：把访客的请求转发到 Supabase，但访客只访问自己的域名，
 *      不直接连 supabase.co（部分国内网络访问不到那个域名）。
 *
 * 路由：仓库根目录 /functions/api/reviews.js  →  线上 /api/reviews
 * GET  → 返回最近 100 条评论
 * POST → 新增一条（relation 必填 ≤20，nickname 选填 ≤20，content 必填 ≤500）
 */

const SUPABASE_URL = 'https://tgxjmmmlccshuxjyyxtk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneGptbW1sY2NzaHV4anl5eHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MzM2NTEsImV4cCI6MjEwOTAwOTY1MX0.BUh8_ORP5xsiw-3PkiLbpEprqmA8b8HTwIt8wpw9ZTY';

const TABLE = 'reviews';
const UPSTREAM_TIMEOUT = 8000;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function authHeaders(extra) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  return Object.assign(headers, extra || {});
}

async function fetchUpstream(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
  try {
    return await fetch(url, Object.assign({ signal: controller.signal }, options));
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestGet() {
  try {
    const url =
      SUPABASE_URL + '/rest/v1/' + TABLE +
      '?select=relation,nickname,content,created_at&order=created_at.desc&limit=100';

    const res = await fetchUpstream(url, { headers: authHeaders() });
    if (!res.ok) {
      return json({ error: 'upstream', status: res.status }, 502);
    }
    const rows = await res.json();
    return json(Array.isArray(rows) ? rows : []);
  } catch (error) {
    return json({ error: 'unreachable', detail: String(error && error.message) }, 504);
  }
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: 'bad-json' }, 400);
  }

  const relation = String((body && body.relation) || '').trim().slice(0, 20);
  const nickname = String((body && body.nickname) || '').trim().slice(0, 20);
  const content = String((body && body.content) || '').trim().slice(0, 500);

  if (!relation || !content) {
    return json({ error: 'missing-fields' }, 400);
  }

  try {
    const res = await fetchUpstream(SUPABASE_URL + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        relation: relation,
        nickname: nickname || null,
        content: content,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: 'upstream', status: res.status, detail: detail.slice(0, 300) }, 502);
    }
    return json({ ok: true }, 201);
  } catch (error) {
    return json({ error: 'unreachable', detail: String(error && error.message) }, 504);
  }
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  return json({ error: 'method-not-allowed' }, 405);
}
