import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import pm from '../api/pmClient';

/* ============================================================
   Helpers
   ============================================================ */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getPriorityColor(p) {
  const lp = (p || '').toLowerCase();
  if (lp === 'urgent' || lp === 'critical') return '#ef4444';
  if (lp === 'high') return '#f97316';
  if (lp === 'low') return '#22c55e';
  return '#3b82f6';
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/* ============================================================
   TaskDetail Drawer
   ============================================================ */
export default function TaskDetail({ task, projectId, users = [], statuses = [], onClose, onUpdated }) {
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [editing, setEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description || '',
    statusId: task.status || '',
    statusHref: task.statusHref || null,
    priority: (task.priority || 'normal').toLowerCase(),
    assigneeId: task.assigneeId != null ? String(task.assigneeId) : '',
  });

  // Sync form when task changes externally
  useEffect(() => {
    setEditForm({
      title: task.title,
      description: task.description || '',
      statusId: task.status || '',
      statusHref: task.statusHref || null,
      priority: (task.priority || 'normal').toLowerCase(),
      assigneeId: task.assigneeId != null ? String(task.assigneeId) : '',
    });
  }, [task.id]);

  // Fetch live statuses if not provided via props
  const { data: liveStatuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => pm.listStatuses(),
    staleTime: 5 * 60 * 1000,
    enabled: statuses.length === 0,
  });

  const effectiveStatuses = statuses.length > 0 ? statuses : liveStatuses;

  // Fetch project members for assignee
  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => pm.listProjectMembers(projectId),
    staleTime: 5 * 60 * 1000,
  });

  // Deduplicate assignees
  const allAssignees = React.useMemo(() => {
    const seen = new Set();
    return [...members, ...users].filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [members, users]);

  // Fetch comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => pm.listComments(task.id),
    staleTime: 30 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: patch => pm.updateTask(task.id, patch),
    onSuccess: updated => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onUpdated?.(updated);
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const commentMutation = useMutation({
    mutationFn: body => pm.addComment(task.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task.id] });
      setCommentText('');
    },
  });

  function handleStatusChange(e) {
    const sel = effectiveStatuses.find(s => s.name === e.target.value);
    setEditForm(f => ({
      ...f,
      statusId: e.target.value,
      statusHref: sel?.href ?? null,
    }));
  }

  function handleSave(e) {
    e.preventDefault();
    updateMutation.mutate({
      title: editForm.title.trim(),
      description: editForm.description,
      statusHref: editForm.statusHref,
      priority: editForm.priority,
      assigneeId: editForm.assigneeId ? Number(editForm.assigneeId) : null,
    });
  }

  function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  }

  function handleMoveToStatus(status) {
    if (!status.href) return;
    updateMutation.mutate({ statusHref: status.href });
  }

  const assignee = allAssignees.find(u => String(u.id) === String(task.assigneeId));

  return (
    <>
      {/* Overlay */}
      <div className="drawer-overlay" onClick={onClose} />

      {/* Drawer */}
      <div className="drawer">
        {/* Header */}
        <div className="drawer-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontWeight: 600,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {task.key}
            </div>
            {editing ? (
              <input
                className="input"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                style={{ fontSize: 15, fontWeight: 600 }}
                autoFocus
              />
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {task.title}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                if (editing) handleSave({ preventDefault: () => {} });
                else setEditing(true);
              }}
              disabled={updateMutation.isPending}
            >
              {editing ? (updateMutation.isPending ? 'Saving...' : 'Save') : 'Edit'}
            </button>
            {editing && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setEditing(false); }}
              >
                Cancel
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '5px 8px' }}
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {saveSuccess && (
            <div className="success-msg" style={{ marginBottom: 16 }}>
              Task updated successfully.
            </div>
          )}
          {updateMutation.error && (
            <div className="error-msg" style={{ marginBottom: 16 }}>
              {updateMutation.error.message}
            </div>
          )}

          {/* Quick status move */}
          {!editing && effectiveStatuses.length > 0 && (
            <div className="drawer-section">
              <div className="drawer-section-title">Move to Status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {effectiveStatuses.map(s => (
                  <button
                    key={s.id}
                    className={`btn btn-sm ${task.status === s.name ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => task.status !== s.name && handleMoveToStatus(s)}
                    disabled={task.status === s.name || updateMutation.isPending || !s.href}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Details section */}
          <div className="drawer-section">
            <div className="drawer-section-title">Details</div>

            {editing ? (
              <div>
                {/* Status + Priority */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="label">Status</label>
                    <select
                      className="select"
                      value={editForm.statusId}
                      onChange={handleStatusChange}
                    >
                      {effectiveStatuses.length === 0 ? (
                        <option value={editForm.statusId}>{editForm.statusId}</option>
                      ) : (
                        effectiveStatuses.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label">Priority</label>
                    <select
                      className="select"
                      value={editForm.priority}
                      onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Assignee */}
                <div className="form-group">
                  <label className="label">Assignee</label>
                  <select
                    className="select"
                    value={editForm.assigneeId}
                    onChange={e => setEditForm(f => ({ ...f, assigneeId: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {allAssignees.map(u => (
                      <option key={u.id} value={String(u.id)}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    rows={5}
                    placeholder="Task description..."
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={updateMutation.isPending || !editForm.title.trim()}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <div>
                {/* Metadata grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '14px 20px',
                    marginBottom: 16,
                  }}
                >
                  {/* Status */}
                  <div>
                    <div className="drawer-section-title" style={{ marginBottom: 6 }}>Status</div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#6b7280',
                          flexShrink: 0,
                        }}
                      />
                      {task.status || '—'}
                    </span>
                  </div>

                  {/* Priority */}
                  <div>
                    <div className="drawer-section-title" style={{ marginBottom: 6 }}>Priority</div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: getPriorityColor(task.priority),
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: getPriorityColor(task.priority),
                          flexShrink: 0,
                        }}
                      />
                      {task.priority || 'Normal'}
                    </span>
                  </div>

                  {/* Assignee */}
                  <div>
                    <div className="drawer-section-title" style={{ marginBottom: 6 }}>Assignee</div>
                    {assignee ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          className="assignee-avatar"
                          style={{
                            width: 22,
                            height: 22,
                            fontSize: 9,
                            background: 'var(--accent-dim)',
                            borderColor: 'var(--accent)',
                          }}
                        >
                          {initials(assignee.name)}
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {assignee.name}
                        </span>
                      </div>
                    ) : task.assigneeName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          className="assignee-avatar"
                          style={{ width: 22, height: 22, fontSize: 9 }}
                        >
                          {initials(task.assigneeName)}
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {task.assigneeName}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Unassigned</span>
                    )}
                  </div>

                  {/* Task ID */}
                  <div>
                    <div className="drawer-section-title" style={{ marginBottom: 6 }}>Task ID</div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      #{task.id}
                    </span>
                  </div>

                  {/* Created */}
                  <div>
                    <div className="drawer-section-title" style={{ marginBottom: 6 }}>Created</div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {formatDateShort(task.createdAt)}
                    </span>
                  </div>

                  {/* Updated */}
                  <div>
                    <div className="drawer-section-title" style={{ marginBottom: 6 }}>Last Updated</div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {formatDate(task.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {task.description && (
                  <div style={{ marginTop: 4 }}>
                    <div className="drawer-section-title" style={{ marginBottom: 8 }}>
                      Description
                    </div>
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        color: 'var(--text-secondary)',
                        fontSize: 14,
                        background: 'var(--bg-elevated)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {task.description}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="drawer-section">
            <div className="drawer-section-title">
              Comments{comments.length > 0 ? ` (${comments.length})` : ''}
            </div>

            {commentsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                <div className="spinner" />
              </div>
            ) : (
              <div className="comment-list">
                {comments.length === 0 && (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    No comments yet. Be the first to comment.
                  </div>
                )}
                {comments.map(c => (
                  <div key={c.id} className="comment-item">
                    <div
                      className="assignee-avatar"
                      style={{
                        width: 28,
                        height: 28,
                        fontSize: 10,
                        flexShrink: 0,
                        marginTop: 2,
                        background: 'var(--accent-dim)',
                        borderColor: 'var(--accent)',
                      }}
                    >
                      {initials(c.authorName)}
                    </div>
                    <div className="comment-bubble">
                      <div className="comment-meta">
                        <strong>{c.authorName ?? 'Unknown'}</strong>
                        <span>·</span>
                        <span>{formatDate(c.createdAt)}</span>
                      </div>
                      <div className="comment-body">{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment form */}
            <form className="comment-input-row" onSubmit={handleComment}>
              <textarea
                className="input"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                style={{ flex: 1, resize: 'none' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (commentText.trim()) commentMutation.mutate(commentText.trim());
                  }
                }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={commentMutation.isPending || !commentText.trim()}
                style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
              >
                {commentMutation.isPending ? '...' : 'Post'}
              </button>
            </form>
            {commentMutation.error && (
              <div className="error-msg" style={{ marginTop: 8 }}>
                {commentMutation.error.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
