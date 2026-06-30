import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import pm from '../api/pmClient';

const STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

function StatusBadge({ status }) {
  const labels = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  return <span className={`badge badge-${status}`}>{labels[status] ?? status}</span>;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function TaskDetail({ task, projectId, users = [], onClose, onUpdated }) {
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId ?? '',
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => pm.listComments(task.id),
  });

  const updateMutation = useMutation({
    mutationFn: (patch) => pm.updateTask(task.id, patch),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onUpdated?.(updated);
      setEditing(false);
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body) => pm.addComment(task.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task.id] });
      setCommentText('');
    },
  });

  const assignee = users.find(u => String(u.id) === String(task.assigneeId));

  function handleSave(e) {
    e.preventDefault();
    updateMutation.mutate({
      title: editForm.title,
      description: editForm.description,
      status: editForm.status,
      priority: editForm.priority,
      assignee_id: editForm.assigneeId || null,
    });
  }

  function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{task.key}</div>
            {editing ? (
              <input
                className="input"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                style={{ fontSize: 16, fontWeight: 600 }}
              />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 600 }}>{task.title}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!editing && (
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="drawer-body">
          {editing ? (
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="label">Status</label>
                  <select className="input select" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Priority</label>
                  <select className="input select" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Assignee</label>
                <select className="input select" value={editForm.assigneeId} onChange={e => setEditForm(f => ({ ...f, assigneeId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {updateMutation.error && <div className="error-msg" style={{ marginBottom: 12 }}>{updateMutation.error.message}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div className="drawer-section">
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div className="drawer-section-title">Status</div>
                    <StatusBadge status={task.status} />
                  </div>
                  <div>
                    <div className="drawer-section-title">Priority</div>
                    <span className={`priority-${task.priority}`} style={{ fontWeight: 600, fontSize: 13 }}>
                      {task.priority ?? '—'}
                    </span>
                  </div>
                  <div>
                    <div className="drawer-section-title">Assignee</div>
                    {assignee ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="assignee-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                          {initials(assignee.name)}
                        </div>
                        <span style={{ fontSize: 13 }}>{assignee.name}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unassigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <div className="drawer-section-title">Dates</div>
                <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div>Created: {formatDate(task.createdAt)}</div>
                  <div>Updated: {formatDate(task.updatedAt)}</div>
                </div>
              </div>

              {task.description && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Description</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {task.description}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Comments */}
          <div className="drawer-section">
            <div className="drawer-section-title">Comments</div>

            {commentsLoading && <div className="spinner" style={{ margin: '8px 0' }} />}

            {comments && (
              <div className="comment-list">
                {comments.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No comments yet.</div>
                )}
                {comments.map(c => (
                  <div key={c.id} className="comment-item">
                    <div className="assignee-avatar" style={{ width: 26, height: 26, fontSize: 11, flexShrink: 0, marginTop: 2 }}>
                      {initials(c.authorName)}
                    </div>
                    <div className="comment-bubble">
                      <div className="comment-meta">
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.authorName ?? 'Unknown'}</span>
                        <span>{formatDate(c.createdAt)}</span>
                      </div>
                      <div className="comment-body">{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form className="comment-input-row" onSubmit={handleComment}>
              <input
                className="input"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={commentMutation.isPending || !commentText.trim()}
                style={{ flexShrink: 0 }}
              >
                {commentMutation.isPending ? '…' : 'Post'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
