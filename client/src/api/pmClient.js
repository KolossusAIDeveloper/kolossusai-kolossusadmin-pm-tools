// PM API adapter — all calls go through this module
// The UI never calls fetch directly.
// Update the TODO(Phase 0) markers once real endpoint shapes are confirmed.

const PROXY_BASE = '/proxy';

let _token = null;

// Call the server-side probe to find which endpoint + auth format works.
// Returns { found, endpoint, authFormat } or { found: false }.
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

async function request(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${PROXY_BASE}${path}`, opts);

  if (res.status === 401) {
    const err = new Error('Unauthorized');
    err.status = 401;
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
      message = data.message || data.error || message;
    } catch {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Pagination helper ──────────────────────────────────────────────────────
async function fetchAllPages(path, queryParams = {}) {
  const results = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({ ...queryParams, page, per_page: 50 });
    // TODO(Phase 0): adjust pagination param names if API uses cursor/offset
    const data = await request('GET', `${path}?${params}`);

    const items = Array.isArray(data)
      ? data
      : data.data ?? data.items ?? data.results ?? data;

    results.push(...items);

    // Stop if fewer items than requested (last page)
    hasMore = items.length === 50;
    page++;
  }

  return results;
}

// ── Normalizers ───────────────────────────────────────────────────────────

function normalizeProject(raw) {
  // TODO(Phase 0): map real API field names
  return {
    id: raw.id ?? raw._id,
    key: raw.key ?? raw.slug ?? raw.identifier ?? String(raw.id),
    name: raw.name ?? raw.title,
    description: raw.description ?? '',
  };
}

function normalizeUser(raw) {
  // TODO(Phase 0): map real API field names
  return {
    id: raw.id ?? raw._id,
    name: raw.name ?? raw.full_name ?? raw.display_name ?? raw.username,
    email: raw.email ?? '',
    avatarUrl: raw.avatar ?? raw.avatar_url ?? raw.profile_picture ?? null,
  };
}

function normalizeTask(raw) {
  // TODO(Phase 0): map real API field names for status, assignee, priority, etc.
  return {
    id: raw.id ?? raw._id,
    key: raw.key ?? raw.identifier ?? String(raw.id),
    title: raw.title ?? raw.name ?? raw.subject,
    description: raw.description ?? raw.body ?? '',
    status: raw.status ?? raw.state ?? 'todo',
    assigneeId: raw.assignee_id ?? raw.assignee?.id ?? raw.assigned_to ?? null,
    priority: raw.priority ?? 'medium',
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? null,
    projectId: raw.project_id ?? raw.project?.id ?? null,
  };
}

function normalizeComment(raw) {
  // TODO(Phase 0): map real API field names
  return {
    id: raw.id ?? raw._id,
    authorId: raw.author_id ?? raw.author?.id ?? raw.user_id ?? null,
    authorName: raw.author?.name ?? raw.author?.username ?? raw.user?.name ?? null,
    body: raw.body ?? raw.content ?? raw.text ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

export const pm = {
  async verifyToken() {
    // Try multiple common endpoints until one succeeds.
    // A 401 on any means the token is definitively wrong.
    // 403/404 on one endpoint just means the path is wrong — keep trying.
    const USER_ENDPOINTS = [
      '/api/me',
      '/api/users/me',
      '/api/v1/me',
      '/api/v1/users/me',
      '/api/auth/me',
      '/api/profile',
      '/api/account',
      '/api/user',
    ];

    let lastErr = null;

    for (const endpoint of USER_ENDPOINTS) {
      try {
        const data = await request('GET', endpoint);
        return { ok: true, user: normalizeUser(data) };
      } catch (err) {
        lastErr = err;
        if (err.status === 401) return { ok: false, user: null };
        // 403 / 404 / 500 — wrong path, try next
      }
    }

    // None of the user-info endpoints worked.
    // Fall back: try listing projects — if that succeeds the token IS valid.
    try {
      await request('GET', '/api/projects');
      return { ok: true, user: { id: null, name: 'User', email: '', avatarUrl: null } };
    } catch (err) {
      if (err.status === 401) return { ok: false, user: null };
      // Throw the most informative error we collected
      throw lastErr || err;
    }
  },

  async listProjects() {
    // TODO(Phase 0): confirm path and pagination
    const raw = await fetchAllPages('/api/projects');
    return raw.map(normalizeProject);
  },

  async getProject(id) {
    const raw = await request('GET', `/api/projects/${id}`);
    return normalizeProject(raw);
  },

  async listUsers() {
    // TODO(Phase 0): confirm path
    const raw = await fetchAllPages('/api/users');
    return raw.map(normalizeUser);
  },

  async listTasks(projectId, filters = {}) {
    const queryParams = { project_id: projectId, ...filters };
    // TODO(Phase 0): confirm path — may be /api/projects/{id}/tasks or /api/tasks?project_id=
    const raw = await fetchAllPages(`/api/projects/${projectId}/tasks`, queryParams);
    return raw.map(normalizeTask);
  },

  async getTask(id) {
    const raw = await request('GET', `/api/tasks/${id}`);
    return normalizeTask(raw);
  },

  async createTask(input) {
    // TODO(Phase 0): confirm required fields and body shape
    const raw = await request('POST', '/api/tasks', {
      title: input.title,
      description: input.description,
      project_id: input.projectId,
      assignee_id: input.assigneeId,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'todo',
    });
    return normalizeTask(raw);
  },

  async updateTask(id, patch) {
    // TODO(Phase 0): confirm PATCH vs PUT, field names
    const raw = await request('PATCH', `/api/tasks/${id}`, patch);
    return normalizeTask(raw);
  },

  async moveTask(id, newStatus) {
    // TODO(Phase 0): may be same as updateTask or a dedicated endpoint
    const raw = await request('PATCH', `/api/tasks/${id}`, { status: newStatus });
    return normalizeTask(raw);
  },

  async listComments(taskId) {
    // TODO(Phase 0): confirm path
    const raw = await fetchAllPages(`/api/tasks/${taskId}/comments`);
    return raw.map(normalizeComment);
  },

  async addComment(taskId, body) {
    // TODO(Phase 0): confirm field name (body vs content vs text)
    const raw = await request('POST', `/api/tasks/${taskId}/comments`, { body });
    return normalizeComment(raw);
  },
};

export default pm;
