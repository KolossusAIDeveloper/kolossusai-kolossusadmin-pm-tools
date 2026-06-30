import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import pm from '../api/pmClient';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function CreateTaskModal({
  projectId,
  initialStatus = '',
  initialStatusHref = null,
  columns = [],
  onClose,
  onCreated,
}) {
  const qc = useQueryClient();

  const initialCol = columns.find(c => c.id === initialStatus) || columns[0] || null;

  const [form, setForm] = useState({
    title: '',
    description: '',
    statusId: initialCol?.id ?? '',
    statusHref: initialCol?.href ?? initialStatusHref ?? null,
    priority: 'normal',
    assigneeId: '',
  });
  const [success, setSuccess] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => pm.listProjectMembers(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => pm.listUsers(),
    staleTime: 5 * 60 * 1000,
  });

  // Deduplicate members + users
  const allAssignees = React.useMemo(() => {
    const seen = new Set();
    return [...members, ...users].filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [members, users]);

  const mutation = useMutation({
    mutationFn: input => pm.createTask(input),
    onSuccess: newTask => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      setSuccess(true);
      setTimeout(() => {
        onCreated?.(newTask);
        onClose();
      }, 800);
    },
  });

  function handleStatusChange(e) {
    const col = columns.find(c => c.id === e.target.value);
    setForm(f => ({
      ...f,
      statusId: e.target.value,
      statusHref: col?.href ?? null,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    mutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      projectId,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      statusHref: form.statusHref,
      priority: form.priority,
    });
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">Create Task</span>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: 16 }}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="success-msg" style={{ textAlign: 'center', padding: '20px 14px' }}>
            Task created successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div className="form-group">
              <label className="label">Title *</label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Enter task title..."
                autoFocus
                required
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="label">Description</label>
              <textarea
                className="input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            {/* Status + Priority row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="label">Status</label>
                <select
                  className="select"
                  value={form.statusId}
                  onChange={handleStatusChange}
                >
                  {columns.length === 0 ? (
                    <option value="">No statuses available</option>
                  ) : (
                    columns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Priority</label>
                <select
                  className="select"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div className="form-group">
              <label className="label">Assignee</label>
              <select
                className="select"
                value={form.assigneeId}
                onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {allAssignees.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Error */}
            {mutation.error && (
              <div className="error-msg" style={{ marginBottom: 16 }}>
                {mutation.error.message}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={mutation.isPending || !form.title.trim()}
              >
                {mutation.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Creating...
                  </span>
                ) : (
                  'Create Task'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
