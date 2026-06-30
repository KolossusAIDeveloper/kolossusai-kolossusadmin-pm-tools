import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import pm from '../api/pmClient';
import Navbar from './Navbar';
import TaskDetail from './TaskDetail';
import CreateTaskModal from './CreateTaskModal';

/* ============================================================
   Helpers
   ============================================================ */
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTimeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getPriorityClass(priority) {
  const p = (priority || '').toLowerCase();
  if (p === 'urgent' || p === 'critical') return 'priority-badge priority-urgent';
  if (p === 'high') return 'priority-badge priority-high';
  if (p === 'low') return 'priority-badge priority-low';
  return 'priority-badge priority-normal';
}

function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('progress') || s.includes('doing') || s.includes('active')) return 'badge badge-inprogress';
  if (s.includes('done') || s.includes('resolv') || s.includes('complete') || s.includes('fixed') || s.includes('closed')) return 'badge badge-done';
  if (s.includes('close')) return 'badge badge-closed';
  return 'badge badge-todo';
}

function getColumnColor(statusName) {
  const s = (statusName || '').toLowerCase();
  if (s.includes('progress') || s.includes('doing') || s.includes('active')) return '#3b82f6';
  if (s.includes('done') || s.includes('resolv') || s.includes('complete') || s.includes('fixed')) return '#22c55e';
  if (s.includes('close')) return '#6b7280';
  if (s.includes('review') || s.includes('test')) return '#a855f7';
  return '#8b949e';
}

const PAGE_SIZE = 25;

/* ============================================================
   TaskCard (Sortable)
   ============================================================ */
function TaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleClick(e) {
    if (!e.defaultPrevented) onClick(task);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="task-card"
      onClick={handleClick}
    >
      <div className="task-key">{task.key}</div>
      <div className="task-title">{task.title}</div>
      <div className="task-footer">
        <span className={getPriorityClass(task.priority)}>{task.priority || 'Normal'}</span>
        <div
          className="assignee-avatar"
          title={task.assigneeName || 'Unassigned'}
          style={
            task.assigneeName
              ? { background: 'var(--accent-dim)', borderColor: 'var(--accent)' }
              : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }
          }
        >
          {task.assigneeName ? initials(task.assigneeName) : '?'}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Column
   ============================================================ */
function Column({ column, tasks, onCardClick, onAddTask }) {
  return (
    <div className="board-column">
      <div className="column-header">
        <div className="column-title">
          <span className="column-dot" style={{ background: column.color }} />
          {column.label}
        </div>
        <span className="column-count">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards" id={`col-${column.id}`}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onCardClick} />
          ))}
          {tasks.length === 0 && (
            <div
              style={{
                padding: '20px 10px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12,
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius)',
              }}
            >
              No tasks
            </div>
          )}
        </div>
      </SortableContext>
      <div style={{ padding: '8px 10px 12px', flexShrink: 0 }}>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: 12, justifyContent: 'center', color: 'var(--text-muted)' }}
          onClick={() => onAddTask(column)}
        >
          + Add task
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ListView
   ============================================================ */
function ListView({ tasks, onTaskClick }) {
  const [sortCol, setSortCol] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
    setPage(0);
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...tasks].sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [tasks, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function SortIndicator({ col }) {
    if (sortCol !== col) return <span style={{ color: 'var(--border)' }}> ↕</span>;
    return <span style={{ color: 'var(--accent)' }}> {sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table className="list-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('key')} style={{ width: 80 }}>
                Key <SortIndicator col="key" />
              </th>
              <th onClick={() => handleSort('title')}>
                Title <SortIndicator col="title" />
              </th>
              <th onClick={() => handleSort('status')} style={{ width: 140 }}>
                Status <SortIndicator col="status" />
              </th>
              <th onClick={() => handleSort('priority')} style={{ width: 110 }}>
                Priority <SortIndicator col="priority" />
              </th>
              <th onClick={() => handleSort('assigneeName')} style={{ width: 160 }}>
                Assignee <SortIndicator col="assigneeName" />
              </th>
              <th onClick={() => handleSort('updatedAt')} style={{ width: 120 }}>
                Updated <SortIndicator col="updatedAt" />
              </th>
            </tr>
          </thead>
          <tbody>
            {slice.map(task => (
              <tr key={task.id} onClick={() => onTaskClick(task)} style={{ cursor: 'pointer' }}>
                <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>
                  {task.key}
                </td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.title}</td>
                <td>
                  <span className={getStatusBadgeClass(task.status)}>{task.status}</span>
                </td>
                <td>
                  <span className={getPriorityClass(task.priority)}>{task.priority || 'Normal'}</span>
                </td>
                <td>
                  {task.assigneeName ? (
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
                        {initials(task.assigneeName)}
                      </div>
                      <span style={{ fontSize: 13 }}>{task.assigneeName}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {formatTimeAgo(task.updatedAt)}
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No tasks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of{' '}
            {sorted.length} tasks
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </button>
            <span
              style={{
                fontSize: 13,
                padding: '5px 10px',
                color: 'var(--text-secondary)',
              }}
            >
              Page {page + 1} / {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MembersTab
   ============================================================ */
function MembersTab({ members, tasks }) {
  const taskCountByMember = useMemo(() => {
    const counts = {};
    tasks.forEach(t => {
      if (t.assigneeId) counts[t.assigneeId] = (counts[t.assigneeId] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  if (members.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128101;</div>
        <div className="empty-state-title">No members found</div>
        <div className="empty-state-desc">This project has no listed members.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 720 }}>
        {members.map(m => {
          const count = taskCountByMember[m.id] || 0;
          return (
            <div key={m.id} className="member-row">
              <div
                className="assignee-avatar"
                style={{
                  width: 38,
                  height: 38,
                  fontSize: 13,
                  background: 'var(--accent-dim)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                {initials(m.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {m.name}
                </div>
                {m.email && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {m.email}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                <span
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '3px 10px',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {count} task{count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   BoardView (main export)
   ============================================================ */
export default function BoardView({ project, onBack, onDashboard }) {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createColumn, setCreateColumn] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState('board'); // 'board' | 'list' | 'members'
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const [syncingNow, setSyncingNow] = useState(false);

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tasks', project.id],
    queryFn: () => pm.listTasks(project.id),
    staleTime: 30 * 1000,
    onSuccess: () => setLastSynced(Date.now()),
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => pm.listStatuses(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', project.id],
    queryFn: () => pm.listProjectMembers(project.id),
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => pm.listUsers(),
    staleTime: 5 * 60 * 1000,
  });

  // Update lastSynced when tasks load
  useEffect(() => {
    if (tasks.length >= 0 && !isLoading) {
      setLastSynced(Date.now());
    }
  }, [isLoading]);

  // Build columns from statuses
  const columns = useMemo(() => {
    if (statuses.length > 0) {
      return statuses.map(s => ({
        id: s.name,
        label: s.name,
        color: getColumnColor(s.name),
        href: s.href,
      }));
    }
    return [
      { id: 'New', label: 'New', color: '#8b949e', href: null },
      { id: 'In Progress', label: 'In Progress', color: '#3b82f6', href: null },
      { id: 'Resolved', label: 'Resolved', color: '#22c55e', href: null },
      { id: 'Closed', label: 'Closed', color: '#6b7280', href: null },
    ];
  }, [statuses]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.key || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && (t.priority || '').toLowerCase() !== filterPriority.toLowerCase()) return false;
      if (filterAssignee && String(t.assigneeId) !== filterAssignee) return false;
      return true;
    });
  }, [tasks, search, filterStatus, filterPriority, filterAssignee]);

  // Group filtered tasks into columns
  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach(c => { map[c.id] = []; });
    filteredTasks.forEach(t => {
      const col = columns.find(c => c.id === t.status)?.id;
      if (col) {
        map[col].push(t);
      } else {
        // Place in first column if status doesn't match any column
        if (columns.length > 0) {
          map[columns[0].id].push(t);
        }
      }
    });
    return map;
  }, [filteredTasks, columns]);

  const moveMutation = useMutation({
    mutationFn: ({ id, newStatusHref }) => pm.moveTask(id, newStatusHref),
    onMutate: async ({ id, newStatus }) => {
      await qc.cancelQueries({ queryKey: ['tasks', project.id] });
      const prev = qc.getQueryData(['tasks', project.id]);
      qc.setQueryData(['tasks', project.id], old =>
        old?.map(t => (t.id === id ? { ...t, status: newStatus } : t))
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', project.id], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', project.id] });
      setLastSynced(Date.now());
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function findColumnForTask(taskId) {
    return columns.find(col => tasksByColumn[col.id]?.some(t => t.id === taskId))?.id;
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    let targetColumnId = null;
    const colMatch = String(over.id).match(/^col-(.+)$/);
    if (colMatch) {
      targetColumnId = colMatch[1];
    } else {
      targetColumnId = findColumnForTask(over.id);
    }

    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (!targetColumn || activeTask.status === targetColumnId) return;
    if (!targetColumn.href) return; // can't move without href

    moveMutation.mutate({
      id: activeTask.id,
      newStatus: targetColumnId,
      newStatusHref: targetColumn.href,
    });
  }

  async function handleSync() {
    setSyncingNow(true);
    await qc.invalidateQueries({ queryKey: ['tasks', project.id] });
    await qc.invalidateQueries({ queryKey: ['statuses'] });
    await qc.invalidateQueries({ queryKey: ['members', project.id] });
    setLastSynced(Date.now());
    setSyncingNow(false);
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  const hasFilters = search || filterStatus || filterPriority || filterAssignee;
  const uniqueStatuses = [...new Set(tasks.map(t => t.status).filter(Boolean))].sort();
  const uniquePriorities = [...new Set(tasks.map(t => t.priority).filter(Boolean))].sort();

  // Combine members and users for assignee dropdown (deduplicate)
  const allMembers = useMemo(() => {
    const seen = new Set();
    const combined = [...members, ...users];
    return combined.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [members, users]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      <Navbar onDashboard={onDashboard} onProjects={onBack} currentView="board" />

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button className="breadcrumb-link" onClick={onDashboard}>
          Dashboard
        </button>
        <span style={{ color: 'var(--border-light)' }}>/</span>
        <button className="breadcrumb-link" onClick={onBack}>
          Projects
        </button>
        <span style={{ color: 'var(--border-light)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{project.name}</span>
      </div>

      {/* Sync bar */}
      <div className="sync-bar">
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: syncingNow ? 'var(--warning)' : 'var(--success)',
            flexShrink: 0,
          }}
        />
        <span>
          {syncingNow
            ? 'Syncing...'
            : lastSynced
            ? `Last synced ${formatTimeAgo(lastSynced)}`
            : 'Loading...'}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 4, fontSize: 11, padding: '3px 8px' }}
          onClick={handleSync}
          disabled={syncingNow}
        >
          {syncingNow ? 'Syncing...' : '↻ Sync'}
        </button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          {hasFilters ? ' (filtered)' : ''}
        </span>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            className="input search-input"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: 200 }}
          />
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              fontSize: 13,
            }}
          >
            &#128269;
          </span>
        </div>

        {/* Status filter */}
        <select
          className="select"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: 150 }}
        >
          <option value="">All statuses</option>
          {uniqueStatuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          className="select"
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          style={{ width: 140 }}
        >
          <option value="">All priorities</option>
          {uniquePriorities.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Assignee filter */}
        <select
          className="select"
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">All assignees</option>
          {allMembers.map(m => (
            <option key={m.id} value={String(m.id)}>{m.name}</option>
          ))}
        </select>

        {/* Clear filters */}
        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); }}
            style={{ color: 'var(--text-muted)', fontSize: 12 }}
          >
            ✕ Clear
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Create Task */}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setCreateColumn(columns[0] || null); setShowCreate(true); }}
        >
          + Create Task
        </button>
      </div>

      {/* Tab nav */}
      <div className="tab-nav">
        {['board', 'list', 'members'].map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'board' ? 'Board' : t === 'list' ? 'List' : 'Members'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="empty-state">
          <div className="empty-state-icon">&#9888;</div>
          <div className="empty-state-title">Failed to load tasks</div>
          <div className="empty-state-desc">{error.message}</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => qc.invalidateQueries({ queryKey: ['tasks', project.id] })}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Board tab */}
      {!isLoading && !error && tab === 'board' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={e => setActiveId(e.active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="board-container">
            {columns.map(col => (
              <Column
                key={col.id}
                column={col}
                tasks={tasksByColumn[col.id] ?? []}
                onCardClick={task => setSelectedTask(task)}
                onAddTask={column => { setCreateColumn(column); setShowCreate(true); }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div
                className="task-card"
                style={{
                  cursor: 'grabbing',
                  boxShadow: 'var(--shadow-lg)',
                  opacity: 0.95,
                  transform: 'rotate(1deg)',
                }}
              >
                <div className="task-key">{activeTask.key}</div>
                <div className="task-title">{activeTask.title}</div>
                <div className="task-footer">
                  <span className={getPriorityClass(activeTask.priority)}>
                    {activeTask.priority || 'Normal'}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* List tab */}
      {!isLoading && !error && tab === 'list' && (
        <ListView tasks={filteredTasks} onTaskClick={task => setSelectedTask(task)} />
      )}

      {/* Members tab */}
      {!isLoading && !error && tab === 'members' && (
        <MembersTab members={allMembers} tasks={tasks} />
      )}

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          projectId={project.id}
          users={allMembers}
          statuses={statuses}
          onClose={() => setSelectedTask(null)}
          onUpdated={updated => {
            setSelectedTask(updated);
            qc.invalidateQueries({ queryKey: ['tasks', project.id] });
          }}
        />
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <CreateTaskModal
          projectId={project.id}
          initialStatus={createColumn?.id || (columns[0]?.id ?? '')}
          initialStatusHref={createColumn?.href || (columns[0]?.href ?? null)}
          columns={columns}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['tasks', project.id] });
            setLastSynced(Date.now());
          }}
        />
      )}
    </div>
  );
}
