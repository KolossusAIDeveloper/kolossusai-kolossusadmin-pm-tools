import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import pm from '../api/pmClient';
import Navbar from './Navbar';
import TaskDetail from './TaskDetail';
import CreateTaskModal from './CreateTaskModal';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function priorityClass(p) {
  const lp = (p || '').toLowerCase();
  if (lp === 'urgent' || lp === 'critical') return 'priority-urgent';
  if (lp === 'high') return 'priority-high';
  if (lp === 'low') return 'priority-low';
  return 'priority-normal';
}

const STATUS_COLORS = [
  '#6c63ff', '#3b82f6', '#22c55e', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
];

const DEFAULT_COLUMNS = [
  { id: 'New', label: 'New', color: '#8b949e', href: '/api/v3/statuses/1' },
  { id: 'In Progress', label: 'In Progress', color: '#388bfd', href: '/api/v3/statuses/2' },
  { id: 'Closed', label: 'Closed', color: '#3fb950', href: '/api/v3/statuses/12' },
];

function TaskCard({ task, onClick }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id, data: { task } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      className="task-card"
      onClick={e => { if (!e.defaultPrevented) onClick(task); }}
    >
      <div className="task-key">{task.key}</div>
      <div className="task-title">{task.title}</div>
      <div className="task-footer">
        <span className={"priority-badge " + priorityClass(task.priority)} style={{ fontSize: 10, padding: '1px 6px' }}>
          {task.priority || 'Normal'}
        </span>
        <div className="assignee-avatar" title={task.assigneeName || 'Unassigned'} style={{ width: 22, height: 22, fontSize: 9 }}>
          {initials(task.assigneeName || '')}
        </div>
      </div>
    </div>
  );
}

function Column({ column, tasks, onCardClick, onAddTask, colorIndex }) {
  const color = STATUS_COLORS[colorIndex % STATUS_COLORS.length];
  return (
    <div className="board-column">
      <div className="column-header">
        <div className="column-title">
          <span className="column-dot" style={{ background: color }} />
          {column.label}
        </div>
        <span className="column-count">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards" id={"col-" + column.id}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onCardClick} />
          ))}
          {tasks.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 8px' }}>
              No tasks
            </div>
          )}
        </div>
      </SortableContext>
      <div style={{ padding: '6px 10px 10px' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}
          onClick={() => onAddTask(column.id)}
        >
          + Add task
        </button>
      </div>
    </div>
  );
}

function ListView({ tasks, users, columns }) {
  const [sortKey, setSortKey] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  const statuses = useMemo(() => [...new Set(tasks.map(t => t.status))].filter(Boolean), [tasks]);
  const priorities = useMemo(() => [...new Set(tasks.map(t => t.priority))].filter(Boolean), [tasks]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  const filtered = useMemo(() => {
    let arr = [...tasks];
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(t => t.title.toLowerCase().includes(q) || String(t.key).toLowerCase().includes(q));
    }
    if (filterStatus) arr = arr.filter(t => t.status === filterStatus);
    if (filterPriority) arr = arr.filter(t => (t.priority || '') === filterPriority);
    if (filterAssignee) arr = arr.filter(t => String(t.assigneeId) === filterAssignee);
    arr.sort((a, b) => {
      let av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      if (sortKey.includes('At')) { av = new Date(av || 0); bv = new Date(bv || 0); }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return arr;
  }, [tasks, search, filterStatus, filterPriority, filterAssignee, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function SortTh({ label, field }) {
    const active = sortKey === field;
    return (
      <th
        onClick={() => toggleSort(field)}
        style={{ color: active ? 'var(--accent)' : undefined, cursor: 'pointer', userSelect: 'none' }}
      >
        {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </th>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ width: 200, padding: '5px 10px', fontSize: 13 }}
          placeholder="Search tasks..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="select" style={{ width: 150, padding: '5px 10px', fontSize: 13 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" style={{ width: 140, padding: '5px 10px', fontSize: 13 }} value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1); }}>
          <option value="">All Priorities</option>
          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="select" style={{ width: 160, padding: '5px 10px', fontSize: 13 }} value={filterAssignee} onChange={e => { setFilterAssignee(e.target.value); setPage(1); }}>
          <option value="">All Assignees</option>
          {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
        </select>
        {(search || filterStatus || filterPriority || filterAssignee) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setPage(1); }}>
            Clear
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} tasks</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#128269;</div>
            <div className="empty-state-title">No tasks match your filters</div>
          </div>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <SortTh label="ID" field="id" />
                <SortTh label="Title" field="title" />
                <SortTh label="Status" field="status" />
                <SortTh label="Priority" field="priority" />
                <th>Assignee</th>
                <SortTh label="Created" field="createdAt" />
                <SortTh label="Updated" field="updatedAt" />
              </tr>
            </thead>
            <tbody>
              {paginated.map(task => {
                const assignee = users.find(u => String(u.id) === String(task.assigneeId));
                return (
                  <tr key={task.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600 }}>{task.key}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: 500 }}>{task.title}</td>
                    <td><span className="badge badge-done" style={{ fontSize: 11 }}>{task.status}</span></td>
                    <td><span className={"priority-badge " + priorityClass(task.priority)} style={{ fontSize: 11 }}>{task.priority || 'Normal'}</span></td>
                    <td>
                      {assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="assignee-avatar" style={{ width: 22, height: 22, fontSize: 9 }}>{initials(assignee.name)}</div>
                          <span style={{ fontSize: 12 }}>{assignee.name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(task.createdAt)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(task.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-outline btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</button>
            {Array.from({length: Math.min(totalPages, 7)}, (_,i) => {
              const p = i+1;
              return <button key={p} className={"btn btn-sm " + (page===p ? 'btn-primary' : 'btn-outline')} onClick={() => setPage(p)}>{p}</button>;
            })}
            {totalPages > 7 && page < totalPages && <button className="btn btn-outline btn-sm" onClick={() => setPage(totalPages)}>{totalPages}</button>}
            <button className="btn btn-outline btn-sm" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MembersView({ projectId, tasks }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => pm.listProjectMembers(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const taskCountByUser = useMemo(() => {
    const map = {};
    tasks.forEach(t => { if (t.assigneeId) map[t.assigneeId] = (map[t.assigneeId] || 0) + 1; });
    return map;
  }, [tasks]);

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <div style={{ marginBottom: 14, fontSize: 14, color: 'var(--text-secondary)' }}>
        {members.length} member{members.length !== 1 ? 's' : ''} in this project
      </div>
      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No members found</div>
          <div className="empty-state-desc">Members appear here once added to the project in PM.</div>
        </div>
      ) : (
        members.map(member => {
          const taskCount = taskCountByUser[member.id] || 0;
          return (
            <div key={member.id} className="member-row">
              <div className="assignee-avatar" style={{ width: 38, height: 38, fontSize: 14, flexShrink: 0 }}>
                {initials(member.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{member.name}</div>
                {member.email && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{member.email}</div>}
              </div>
              <span className="tag">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function BoardView({ project, onBack, onDashboard }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('board');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [searchBoard, setSearchBoard] = useState('');
  const [filterStatusBoard, setFilterStatusBoard] = useState('');

  const { data: tasks = [], isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['tasks', project.id],
    queryFn: () => pm.listTasks(project.id),
    staleTime: 30 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => pm.listUsers(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => pm.listStatuses(),
    staleTime: 5 * 60 * 1000,
  });

  const columns = useMemo(() => {
    if (statuses.length) return statuses.map((s, i) => ({ id: s.name, label: s.name, color: STATUS_COLORS[i % STATUS_COLORS.length], href: s.href }));
    return DEFAULT_COLUMNS;
  }, [statuses]);

  const moveMutation = useMutation({
    mutationFn: ({ id, newStatusHref }) => pm.moveTask(id, newStatusHref),
    onMutate: async ({ id, newStatus }) => {
      await qc.cancelQueries({ queryKey: ['tasks', project.id] });
      const prev = qc.getQueryData(['tasks', project.id]);
      qc.setQueryData(['tasks', project.id], old => old?.map(t => t.id === id ? { ...t, status: newStatus } : t));
      return { prev };
    },
    onError: (_, __, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks', project.id], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', project.id] }),
  });

  const filteredTasksBoard = useMemo(() => {
    let arr = tasks;
    if (searchBoard) { const q = searchBoard.toLowerCase(); arr = arr.filter(t => t.title.toLowerCase().includes(q) || String(t.key).includes(q)); }
    if (filterStatusBoard) arr = arr.filter(t => t.status === filterStatusBoard);
    return arr;
  }, [tasks, searchBoard, filterStatusBoard]);

  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach(c => { map[c.id] = []; });
    filteredTasksBoard.forEach(t => {
      const colId = columns.find(c => c.id === t.status)?.id ?? columns[0]?.id;
      if (colId) (map[colId] ||= []).push(t);
    });
    return map;
  }, [filteredTasksBoard, columns]);

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
    if (colMatch) targetColumnId = colMatch[1];
    else targetColumnId = findColumnForTask(over.id);
    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (!targetColumn || activeTask.status === targetColumnId) return;
    moveMutation.mutate({ id: activeTask.id, newStatus: targetColumnId, newStatusHref: targetColumn.href });
  }

  function handleSync() {
    qc.invalidateQueries({ queryKey: ['tasks', project.id] });
    qc.invalidateQueries({ queryKey: ['statuses'] });
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['members', project.id] });
  }

  const syncTime = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <Navbar onDashboard={onDashboard} onProjects={onBack} currentView="board" />

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <button className="breadcrumb-link" onClick={onBack}>Projects</button>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontWeight: 700 }}>{project.name}</span>
          {project.key && <span className="tag" style={{ marginLeft: 4 }}>{project.key}</span>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {syncTime && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Synced {syncTime}</span>}
          <button className="btn btn-ghost btn-sm" onClick={handleSync}>Sync</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setCreateStatus(columns[0]?.id || ''); setShowCreate(true); }}>
            + Create Task
          </button>
        </div>
      </div>

      <div className="tab-nav" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 20px', flexShrink: 0 }}>
        {['board', 'list', 'members'].map(t => (
          <button key={t} className={"tab-btn" + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
            {t === 'board' ? 'Board' : t === 'list' ? 'List' : 'Members'}
            {t !== 'members' && <span style={{ marginLeft: 6, fontSize: 11, color: tab === t ? 'var(--accent)' : 'var(--text-muted)' }}>{tasks.length}</span>}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>}
      {error && !isLoading && <div style={{ padding: 20 }}><div className="error-msg">Failed to load tasks: {error.message} <button className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={handleSync}>Retry</button></div></div>}

      {!isLoading && !error && tab === 'board' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
            <input className="input" style={{ width: 200, padding: '5px 10px', fontSize: 12 }} placeholder="Search tasks..." value={searchBoard} onChange={e => setSearchBoard(e.target.value)} />
            <select className="select" style={{ width: 160, padding: '5px 10px', fontSize: 12 }} value={filterStatusBoard} onChange={e => setFilterStatusBoard(e.target.value)}>
              <option value="">All Statuses</option>
              {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            {(searchBoard || filterStatusBoard) && <button className="btn btn-ghost btn-sm" onClick={() => { setSearchBoard(''); setFilterStatusBoard(''); }}>Clear</button>}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filteredTasksBoard.length} of {tasks.length} tasks</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 14, height: '100%', alignItems: 'flex-start' }}>
                {columns.map((col, i) => (
                  <Column key={col.id} column={col} tasks={tasksByColumn[col.id] ?? []} onCardClick={setSelectedTask} colorIndex={i} onAddTask={sid => { setCreateStatus(sid); setShowCreate(true); }} />
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="task-card" style={{ cursor: 'grabbing', boxShadow: 'var(--shadow-lg)', opacity: 0.92, width: 260 }}>
                  <div className="task-key">{activeTask.key}</div>
                  <div className="task-title">{activeTask.title}</div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {!isLoading && !error && tab === 'list' && (
        <ListView tasks={tasks} users={users} columns={columns} onTaskClick={setSelectedTask} />
      )}

      {tab === 'members' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <MembersView projectId={project.id} tasks={tasks} />
        </div>
      )}

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          projectId={project.id}
          users={users}
          statuses={statuses}
          onClose={() => setSelectedTask(null)}
          onUpdated={updated => { qc.invalidateQueries({ queryKey: ['tasks', project.id] }); setSelectedTask(updated); }}
        />
      )}

      {showCreate && (
        <CreateTaskModal
          projectId={project.id}
          initialStatus={createStatus}
          columns={columns}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
