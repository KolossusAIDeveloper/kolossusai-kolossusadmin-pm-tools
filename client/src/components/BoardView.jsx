import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import pm from '../api/pmClient';
import Navbar from './Navbar';
import TaskDetail from './TaskDetail';
import CreateTaskModal from './CreateTaskModal';

const DEFAULT_COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#8b949e' },
  { id: 'in_progress', label: 'In Progress', color: '#388bfd' },
  { id: 'review', label: 'Review', color: '#bc8cff' },
  { id: 'done', label: 'Done', color: '#3fb950' },
];

function TaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners} className="task-card" onClick={e => { if (!e.defaultPrevented) onClick(task); }}><div className="task-key">{task.key}</div><div className="task-title">{task.title}</div><div className="task-footer"><div className="task-priority-dot" title={task.priority} /><div className="assignee-avatar" title={task.assigneeName || 'Unassigned'}>{task.assigneeName ? task.assigneeName.slice(0, 2).toUpperCase() : '?'}</div></div></div>;
}

function Column({ column, tasks, onCardClick, onAddTask }) {
  return <div className="board-column"><div className="column-header"><div className="column-title"><span className="column-dot" style={{ background: column.color }} />{column.label}</div><span className="column-count">{tasks.length}</span></div><SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}><div className="column-cards" id={`col-${column.id}`}>{tasks.map(task => <TaskCard key={task.id} task={task} onClick={onCardClick} />)}</div></SortableContext><div style={{ padding: '8px 10px 12px' }}><button className="btn btn-ghost" style={{ width: '100%', fontSize: 12, justifyContent: 'center', color: 'var(--text-muted)' }} onClick={() => onAddTask(column.id)}>+ Add task</button></div></div>;
}

export default function BoardView({ project, onBack }) {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState('todo');
  const [activeId, setActiveId] = useState(null);
  const { data: tasks = [], isLoading, error } = useQuery({ queryKey: ['tasks', project.id], queryFn: () => pm.listTasks(project.id) });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => pm.listUsers(), staleTime: 5 * 60 * 1000 });
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: () => pm.listStatuses(), staleTime: 5 * 60 * 1000 });
  const columns = statuses.length ? statuses.map(s => ({ id: s.name, label: s.name, color: '#8b949e', href: s.href })) : DEFAULT_COLUMNS;
  const moveMutation = useMutation({ mutationFn: ({ id, newStatusHref }) => pm.moveTask(id, newStatusHref), onMutate: async ({ id, newStatus }) => { await qc.cancelQueries({ queryKey: ['tasks', project.id] }); const prev = qc.getQueryData(['tasks', project.id]); qc.setQueryData(['tasks', project.id], old => old?.map(t => t.id === id ? { ...t, status: newStatus } : t)); return { prev }; }, onError: (_, __, ctx) => { if (ctx?.prev) qc.setQueryData(['tasks', project.id], ctx.prev); }, onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', project.id] }) });
  const tasksByColumn = useMemo(() => { const map = {}; columns.forEach(c => { map[c.id] = []; }); tasks.forEach(t => { const col = columns.find(c => c.id === t.status)?.id || columns[0]?.id || 'todo'; (map[col] ||= []).push(t); }); return map; }, [tasks, columns]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function findColumnForTask(taskId) { return columns.find(col => tasksByColumn[col.id]?.some(t => t.id === taskId))?.id; }
  function handleDragEnd(event) { const { active, over } = event; setActiveId(null); if (!over) return; const activeTask = tasks.find(t => t.id === active.id); if (!activeTask) return; let targetColumnId = null; const colMatch = String(over.id).match(/^col-(.+)$/); if (colMatch) targetColumnId = colMatch[1]; else targetColumnId = findColumnForTask(over.id); const targetColumn = columns.find(c => c.id === targetColumnId); if (!targetColumn || activeTask.status === targetColumnId) return; moveMutation.mutate({ id: activeTask.id, newStatus: targetColumnId, newStatusHref: targetColumn.href }); }
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}><Navbar /><div className="breadcrumb"><button className="breadcrumb-link" onClick={onBack}>Projects</button><span>/</span><span style={{ color: 'var(--text-primary)' }}>{project.name}</span></div><div className="toolbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="project-key">{project.key}</span><span style={{ fontWeight: 600, fontSize: 15 }}>{project.name} Board</span></div><button className="btn btn-primary" onClick={() => { setCreateStatus(columns[0]?.id || 'todo'); setShowCreate(true); }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>Create Task</button></div>{isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>}{error && <div className="empty-state"><div className="empty-state-icon">⚠️</div><div className="empty-state-title">Failed to load tasks</div><div className="empty-state-desc">{error.message}</div></div>}{!isLoading && !error && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}><div className="board-container">{columns.map(col => <Column key={col.id} column={col} tasks={tasksByColumn[col.id] ?? []} onCardClick={setSelectedTask} onAddTask={status => { setCreateStatus(status); setShowCreate(true); }} />)}</div><DragOverlay>{activeTask && <div className="task-card" style={{ cursor: 'grabbing', boxShadow: 'var(--shadow-md)', opacity: 0.9 }}><div className="task-key">{activeTask.key}</div><div className="task-title">{activeTask.title}</div></div>}</DragOverlay></DndContext>}{selectedTask && <TaskDetail task={selectedTask} projectId={project.id} users={users} onClose={() => setSelectedTask(null)} onUpdated={updated => setSelectedTask(updated)} />}{showCreate && <CreateTaskModal projectId={project.id} initialStatus={createStatus} columns={columns} onClose={() => setShowCreate(false)} />}</div>;
}
