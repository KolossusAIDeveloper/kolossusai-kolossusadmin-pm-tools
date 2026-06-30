// PM API adapter — OpenProject v3 REST API
// Auth: Basic base64(apikey:TOKEN) — OpenProject's documented API key format
// All calls go through this module; the UI never calls fetch directly.

const PROXY_BASE = '/proxy';

let _token = null;

export async function probeApi(token) {
  const res = await fetch(`/api/probe?token=${encodeURIComponent(token)}`);
  if (!res.ok) return { found: false };
  return res.json();
}

export function setToken(token) {
  _token = token;
}

export function clearToken() {
  _token = null;
}

export function getToken() {
  return _token;
}

function basicAuthHeader(token) {
  // OpenProject: username="apikey", password=token
  return `Basic ${btoa(`apikey:${token}`)}`;
}

async function request(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/hal+json, application/json',
  };

  if (_token) {
    headers['Authorization'] = basicAuthHeader(_token);
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${PROXY_BASE}${path}`, opts);

  if (res.status === 401) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (res.status === 403) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  if (res.status === 429) {
    const err = new Error('Rate limited — please wait and try again');
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.message || data.errorIdentifier || message;
    } catch {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── OpenProject HAL+JSON pagination ──────────────────────────────────────────
async function fetchAllPages(path, queryParams = {}) {
  const results = [];
  let offset = 1;
  const pageSize = 50;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({ ...queryParams, offset, pageSize });
    const data = await request('GET', `${path}?${params}`);

    // OpenProject wraps results in _embedded.elements
    const items = data?._embedded?.elements ?? (Array.isArray(data) ? data : []);
    results.push(...items);

    const total = data.total ?? items.length;
    hasMore = offset * pageSize < total;
    offset++;
  }

  return results;
}

// ── Normalizers — map OpenProject HAL+JSON onto stable internal types ─────────

function normalizeProject(raw) {
  return {
    id: raw.id,
    key: raw.identifier ?? String(raw.id),
    name: raw.name,
    description: raw.description?.raw ?? raw.description ?? '',
  };
}

function normalizeUser(raw) {
  const firstName = raw.firstName ?? '';
  const lastName = raw.lastName ?? '';
  const fullName = raw.name ?? `${firstName} ${lastName}`.trim() || raw.login ?? '';
  return {
    id: raw.id,
    name: fullName,
    email: raw.email ?? '',
    avatarUrl: raw.avatar ?? null,
  };
}

function normalizeTask(raw) {
  const links = raw._links ?? {};
  return {
    id: raw.id,
    key: `#${raw.id}`,
    title: raw.subject ?? raw.title ?? '',
    description: raw.description?.raw ?? raw.description ?? '',
    status: links.status?.title ?? raw.status ?? 'New',
    statusHref: links.status?.href ?? null,
    assigneeId: links.assignee?.href
      ? Number(links.assignee.href.split('/').pop())
      : null,
    assigneeName: links.assignee?.title ?? null,
    priority: links.priority?.title ?? 'Normal',
    projectId: links.project?.href
      ? Number(links.project.href.split('/').pop())
      : null,
    lockVersion: raw.lockVersion ?? 0,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

function normalizeComment(raw) {
  const links = raw._links ?? {};
  return {
    id: raw.id,
    authorId: links.user?.href ? Number(links.user.href.split('/').pop()) : null,
    authorName: links.user?.title ?? null,
    body: raw.comment?.raw ?? raw.comment?.html ?? '',
    createdAt: raw.createdAt ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const pm = {
  async verifyToken() {
    try {
      const data = await request('GET', '/api/v3/users/me');
      return { ok: true, user: normalizeUser(data) };
    } catch (err) {
      if (err.status === 401) return { ok: false, user: null };
      throw err;
    }
  },

  async listProjects() {
    const raw = await fetchAllPages('/api/v3/projects');
    return raw.map(normalizeProject);
  },

  async getProject(id) {
    const raw = await request('GET', `/api/v3/projects/${id}`);
    return normalizeProject(raw);
  },

  async listUsers() {
    try {
      const raw = await fetchAllPages('/api/v3/users');
      return raw.map(normalizeUser);
    } catch {
      // /api/v3/users requires admin; fall back to empty list
      return [];
    }
  },

  async listProjectMembers(projectId) {
    try {
      const raw = await fetchAllPages(`/api/v3/projects/${projectId}/members`);
      return raw.map(m => normalizeUser(m._links?.principal ?? m));
    } catch {
      return [];
    }
  },

  async listTasks(projectId, filters = {}) {
    const queryParams = {};
    if (filters.status) queryParams['filters'] = JSON.stringify([{ status: { operator: '=', values: [filters.status] } }]);
    const raw = await fetchAllPages(`/api/v3/projects/${projectId}/work_packages`, queryParams);
    return raw.map(normalizeTask);
  },

  async getTask(id) {
    const raw = await request('GET', `/api/v3/work_packages/${id}`);
    return normalizeTask(raw);
  },

  async createTask(input) {
    const body = {
      subject: input.title,
      description: { raw: input.description ?? '' },
      _links: {},
    };
    if (input.assigneeId) {
      body._links.assignee = { href: `/api/v3/users/${input.assigneeId}` };
    }
    const raw = await request('POST', `/api/v3/projects/${input.projectId}/work_packages`, body);
    return normalizeTask(raw);
  },

  async updateTask(id, patch) {
    // Must include lockVersion to avoid conflicts
    const current = await request('GET', `/api/v3/work_packages/${id}`);
    const body = {
      lockVersion: current.lockVersion,
      _links: {},
    };
    if (patch.title) body.subject = patch.title;
    if (patch.description !== undefined) body.description = { raw: patch.description };
    if (patch.assigneeId) body._links.assignee = { href: `/api/v3/users/${patch.assigneeId}` };
    const raw = await request('PATCH', `/api/v3/work_packages/${id}`, body);
    return normalizeTask(raw);
  },

  async moveTask(id, newStatusHref) {
    const current = await request('GET', `/api/v3/work_packages/${id}`);
    const body = {
      lockVersion: current.lockVersion,
      _links: { status: { href: newStatusHref } },
    };
    const raw = await request('PATCH', `/api/v3/work_packages/${id}`, body);
    return normalizeTask(raw);
  },

  async listStatuses() {
    try {
      const data = await request('GET', '/api/v3/statuses');
      return (data?._embedded?.elements ?? []).map(s => ({
        id: s.id,
        name: s.name,
        href: s._links?.self?.href ?? `/api/v3/statuses/${s.id}`,
        isClosed: s.isClosed ?? false,
      }));
    } catch {
      return [];
    }
  },

  async listComments(taskId) {
    try {
      const data = await request('GET', `/api/v3/work_packages/${taskId}/activities`);
      const elements = data?._embedded?.elements ?? [];
      return elements
        .filter(a => a.comment?.raw)
        .map(normalizeComment);
    } catch {
      return [];
    }
  },

  async addComment(taskId, body) {
    const raw = await request('POST', `/api/v3/work_packages/${taskId}/activities`, {
      comment: { raw: body },
    });
    return normalizeComment(raw);
  },
};

export default pm;
