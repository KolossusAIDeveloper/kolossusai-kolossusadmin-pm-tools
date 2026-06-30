import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export default function CreateTaskModal({ projectId, initialStatus = 'todo', onClose, onCreated }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: initialStatus,
    priority: 'medium',
    assigneeId: '',
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => pm.listUsers(),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (input) => pm.createTask(input),
    onSuccess: (newTask) => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onCreated?.(newTask);
      onClose();
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    mutation.mutate({
      ...form,
      projectId,
      assigneeId: form.assigneeId || null,
    });
  }

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Create Task</span>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Task title…"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Description</label>
            <textarea
              className="input"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description…"
              rows={3}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="label">Status</label>
              <select
                className="input select"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Priority</label>
              <select
                className="input select"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Assignee</label>
            <select
              className="input select"
              value={form.assigneeId}
              onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {users?.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {mutation.error && (
            <div className="error-msg" style={{ marginBottom: 12 }}>
              {mutation.error.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mutation.isPending || !form.title.trim()}
            >
              {mutation.isPending ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Creating…</> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
