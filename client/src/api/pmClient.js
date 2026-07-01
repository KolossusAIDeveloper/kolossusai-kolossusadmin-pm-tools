// PM API adapter — OpenProject v3 REST API
// Auth: Basic base64(apikey:TOKEN)

const PROXY_BASE = '/proxy';
let _token = null;

export async function probeApi(token) {
  const res = await fetch(`/api/probe?token=${encodeURIComponent(token)}`);
  if (!res.ok) return { found: false };
  return res.json();
}

export function setToken(token) { _token = token; }
export function clearToken() { _token = null; }
export function getToken() { return _token; }

function basicAuthHeader(token) {
  return 'Basic ' + btoa(`apikey:${token}`);
}

async function request(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/hal+json, application/json',
  };
  if (_token) headers.Authorization = basicAuthHeader(_token);
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${PROXY_BASE}${path}`, opts);
  if (res.status === 401) { const err = new Error('Unauthorized'); err.status = 401; throw err; }
  if (res.status === 403) { const err = new Error('Forbidden'); err.status = 403; throw err; }
  if (res.status === 429) { const err = new Error('Rate limited — please wait and try again'); err.status = 429; throw err; }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const data = await res.json(); message = data.message || data.errorIdentifier || message; } catch {}
    const err = new Error(message); err.status = res.status; throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function fetchAllPages(path, queryParams = {}) {
  const results = [];
  let offset = 1;
  const pageSize = 50;
  let hasMore = true;
  while (hasMore) {
    const params = new URLSearchParams({ ...queryParams, offset, pageSize });
    const data = await request('GET', `${path}?${params}`);
    const items = data?._embedded?.elements ?? (Array.isArray(data) ? data : []);
    results.push(...items);
    const total = data.total ?? items.length;
    hasMore = offset * pageSize < total;
    offset++;
  }
  return results;
}

function normalizeProject(raw) { return { id: raw.id, key: raw.identifier ?? String(raw.id), name: raw.name, description: raw.description?.raw ?? raw.description ?? '' }; }
function normalizeUser(raw) { const fullName = raw.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || raw.login || ''; return { id: raw.id, name: fullName, email: raw.email || '', avatarUrl: raw.avatar || null }; }
function normalizeTask(raw) {
  const links = raw._links ?? {};
  return { id: raw.id, key: `#${raw.id}`, title: raw.subject ?? raw.title ?? '', description: raw.description?.raw ?? raw.description ?? '', status: links.status?.title ?? raw.status ?? 'todo', statusHref: links.status?.href ?? null, assigneeId: links.assignee?.href ? Number(links.assignee.href.split('/').pop()) : null, assigneeName: links.assignee?.title ?? null, priority: links.priority?.title ?? 'medium', projectId: links.project?.href ? Number(links.project.href.split('/').pop()) : null, lockVersion: raw.lockVersion ?? 0, createdAt: raw.createdAt ?? null, updatedAt: raw.updatedAt ?? null };
}
function normalizeComment(raw) { const links = raw._links ?? {}; return { id: raw.id, authorId: links.user?.href ? Number(links.user.href.split('/').pop()) : null, authorName: links.user?.title ?? null, body: raw.comment?.raw ?? raw.comment?.html ?? '', createdAt: raw.createdAt ?? null }; }

export const pm = {
  async verifyToken() { try { const data = await request('GET', '/api/v3/users/me'); return { ok: true, user: normalizeUser(data) }; } catch (err) { if (err.status === 401) return { ok: false, user: null }; throw err; } },
  async listProjects() { return (await fetchAllPages('/api/v3/projects')).map(normalizeProject); },
  async getProject(id) { return normalizeProject(await request('GET', `/api/v3/projects/${id}`)); },
  async listUsers() { try { return (await fetchAllPages('/api/v3/users', { sortBy: JSON.stringify([['name', 'asc']]) })).map(normalizeUser); } catch { return []; } },
  async listProjectMembers(projectId) {
    const seen = new Map();
    // Always include current logged-in user
    try { const me = await request('GET', '/api/v3/users/me'); const u = normalizeUser(me); if (u.id) seen.set(u.id, u); } catch {}
    // Try /api/v3/memberships with project filter (OpenProject standard)
    try {
      const filters = JSON.stringify([{ project: { operator: '=', values: [String(projectId)] } }]);
      const items = await fetchAllPages('/api/v3/memberships', { filters });
      for (const m of items) {
        const p = m._links?.principal;
        if (!p?.href) continue;
        const id = Number(p.href.split('/').pop());
        if (id && !isNaN(id) && !seen.has(id)) seen.set(id, { id, name: p.title || 'Unknown', email: '', avatarUrl: null });
      }
    } catch {}
    // Fallback: direct project members endpoint
    if (seen.size <= 1) {
      try {
        const items = await fetchAllPages(`/api/v3/projects/${projectId}/members`);
        for (const m of items) {
          const p = m._links?.principal;
          const id = p?.href ? Number(p.href.split('/').pop()) : m.id;
          const name = p?.title || m.name || '';
          if (id && !isNaN(id) && !seen.has(id)) seen.set(id, { id, name: name || 'Unknown', email: m.email || '', avatarUrl: null });
        }
      } catch {}
    }
    return [...seen.values()];
  },
  async listStatuses() { try { const data = await request('GET', '/api/v3/statuses'); return (data?._embedded?.elements ?? []).map(s => ({ id: s.id, name: s.name, href: s._links?.self?.href ?? `/api/v3/statuses/${s.id}`, isClosed: s.isClosed ?? false })); } catch { return []; } },
  async listTasks(projectId, filters = {}) { const queryParams = {}; if (filters.status) queryParams.filters = JSON.stringify([{ status: { operator: '=', values: [filters.status] } }]); return (await fetchAllPages(`/api/v3/projects/${projectId}/work_packages`, queryParams)).map(normalizeTask); },
  async getTask(id) { return normalizeTask(await request('GET', `/api/v3/work_packages/${id}`)); },
  async createTask(input) {
    const body = { subject: input.title, description: { raw: input.description ?? '' }, _links: {} };
    if (input.assigneeId) body._links.assignee = { href: `/api/v3/users/${input.assigneeId}` };
    if (input.statusHref) body._links.status = { href: input.statusHref };
    const raw = await request('POST', `/api/v3/projects/${input.projectId}/work_packages`, body);
    return normalizeTask(raw);
  },
  async updateTask(id, patch) {
    const current = await request('GET', `/api/v3/work_packages/${id}`);
    const body = { lockVersion: current.lockVersion, _links: {} };
    if (patch.title) body.subject = patch.title;
    if (patch.description !== undefined) body.description = { raw: patch.description };
    if (patch.assigneeId !== undefined) body._links.assignee = patch.assigneeId ? { href: `/api/v3/users/${patch.assigneeId}` } : null;
    if (patch.statusHref) body._links.status = { href: patch.statusHref };
    if (patch.priority) body._links.priority = { href: patch.priority };
    const raw = await request('PATCH', `/api/v3/work_packages/${id}`, body);
    return normalizeTask(raw);
  },
  async moveTask(id, newStatusHref) { const current = await request('GET', `/api/v3/work_packages/${id}`); return normalizeTask(await request('PATCH', `/api/v3/work_packages/${id}`, { lockVersion: current.lockVersion, _links: { status: { href: newStatusHref } } })); },
  async listComments(taskId) { try { const data = await request('GET', `/api/v3/work_packages/${taskId}/activities`); return (data?._embedded?.elements ?? []).filter(a => a.comment?.raw).map(normalizeComment); } catch { return []; } },
  async addComment(taskId, body) { return normalizeComment(await request('POST', `/api/v3/work_packages/${taskId}/activities`, { comment: { raw: body } })); },
};

export default pm;
