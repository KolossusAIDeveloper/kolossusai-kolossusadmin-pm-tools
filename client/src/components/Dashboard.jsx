import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import pm from '../api/pmClient';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './Navbar';
import CreateTaskModal from './CreateTaskModal';

function StatCard({ label, value, color, subtitle }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color: color || 'var(--accent)' }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
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
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function getPriorityColor(p) {
  const lp = (p || '').toLowerCase();
  if (lp === 'urgent' || lp === 'critical') return '#ef4444';
  if (lp === 'high') return '#f97316';
  if (lp === 'low') return '#22c55e';
  return '#3b82f6';
}

function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('progress') || s.includes('doing') || s.includes('working') || s.includes('active'))
    return 'badge badge-inprogress';
  if (
    s.includes('done') ||
    s.includes('resolv') ||
    s.includes('complete') ||
    s.includes('finish') ||
    s.includes('fixed') ||
    s.includes('closed')
  )
    return 'badge badge-done';
  if (s.includes('close')) return 'badge badge-closed';
  return 'badge badge-todo';
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const MAX_PROJECTS_FOR_STATS = 8;

export default function Dashboard({ onGoToProjects, onOpenProject }) {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProjectForCreate, setSelectedProjectForCreate] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => pm.listProjects(),
    staleTime: 60 * 1000,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => pm.listStatuses(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch tasks for first N projects to populate dashboard stats
  useEffect(() => {
    if (projects.length === 0) return;
    setTasksLoading(true);
    const slice = projects.slice(0, MAX_PROJECTS_FOR_STATS);
    Promise.all(slice.map(p => pm.listTasks(p.id).catch(() => [])))
      .then(results => {
        setAllTasks(results.flat());
        setTasksLoading(false);
      })
      .catch(() => setTasksLoading(false));
  }, [projects.length]);

  const stats = useMemo(() => {
    const total = allTasks.length;
    const inProgress = allTasks.filter(t => {
      const s = (t.status || '').toLowerCase();
      return s.includes('progress') || s.includes('doing') || s.includes('working') || s.includes('active');
    }).length;
    const done = allTasks.filter(t => {
      const s = (t.status || '').toLowerCase();
      return (
        s.includes('done') ||
        s.includes('resolv') ||
        s.includes('complete') ||
        s.includes('fixed') ||
        s.includes('closed')
      );
    }).length;
    const open = total - done;
    const myTasks = allTasks.filter(
      t => t.assigneeId && user && String(t.assigneeId) === String(user.id)
    );
    return { total, inProgress, done, open, myTasks };
  }, [allTasks, user]);

  const recentTasks = useMemo(
    () =>
      [...allTasks]
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 10),
    [allTasks]
  );

  const statusDistribution = useMemo(() => {
    const counts = {};
    allTasks.forEach(t => {
      const s = t.status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [allTasks]);

  const projectTaskCounts = useMemo(() => {
    const counts = {};
    allTasks.forEach(t => {
      if (t.projectId) counts[t.projectId] = (counts[t.projectId] || 0) + 1;
    });
    return counts;
  }, [allTasks]);

  const defaultProject = projects[0] || null;
  const slicedProjects = projects.length > MAX_PROJECTS_FOR_STATS
    ? `first ${MAX_PROJECTS_FOR_STATS} projects`
    : `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

  function getStatusColor(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('progress') || s.includes('doing') || s.includes('active')) return '#3b82f6';
    if (s.includes('done') || s.includes('resolv') || s.includes('complete') || s.includes('fixed'))
      return '#22c55e';
    if (s.includes('close')) return '#374151';
    return '#6b7280';
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Navbar
        onDashboard={() => {}}
        onProjects={onGoToProjects}
        currentView="dashboard"
      />

      <div
        style={{
          flex: 1,
          padding: '28px',
          maxWidth: 1400,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Here is an overview of your workspace across {slicedProjects}.
          </div>
        </div>

        {/* Stats Row */}
        <div className="dashboard-grid" style={{ marginBottom: 32 }}>
          <StatCard
            label="Total Projects"
            value={projectsLoading ? '...' : projects.length}
            color="var(--accent)"
          />
          <StatCard
            label="Total Tasks"
            value={tasksLoading ? '...' : stats.total}
            color="var(--accent)"
            subtitle={`across ${Math.min(projects.length, MAX_PROJECTS_FOR_STATS)} projects`}
          />
          <StatCard
            label="Open Tasks"
            value={tasksLoading ? '...' : stats.open}
            color="var(--warning)"
          />
          <StatCard
            label="In Progress"
            value={tasksLoading ? '...' : stats.inProgress}
            color="#3b82f6"
          />
          <StatCard
            label="Completed"
            value={tasksLoading ? '...' : stats.done}
            color="var(--success)"
          />
          <StatCard
            label="My Tasks"
            value={tasksLoading ? '...' : stats.myTasks.length}
            color="var(--accent)"
            subtitle="assigned to you"
          />
        </div>

        {/* Two-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 24,
            marginBottom: 24,
          }}
        >
          {/* Recent Activity */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Recent Activity</div>
            {tasksLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : recentTasks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '16px 0' }}>
                No recent activity.
              </div>
            ) : (
              <div className="activity-feed">
                {recentTasks.map(task => (
                  <div key={task.id} className="activity-item">
                    <div className="activity-icon">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: getPriorityColor(task.priority),
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {task.title}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 3,
                        }}
                      >
                        <span className={getStatusBadgeClass(task.status)}>{task.status}</span>
                        {task.assigneeName && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {task.assigneeName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatTimeAgo(task.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task Distribution */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Task Distribution</div>
            {tasksLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : statusDistribution.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '16px 0' }}>
                No data yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {statusDistribution.map(([status, count]) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  const color = getStatusColor(status);
                  return (
                    <div key={status}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 5,
                        }}
                      >
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {status}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                            }}
                          >
                            {pct}%
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              minWidth: 24,
                              textAlign: 'right',
                            }}
                          >
                            {count}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: 'var(--bg-elevated)',
                          borderRadius: 9999,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: color,
                            borderRadius: 9999,
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* My Tasks */}
        {stats.myTasks.length > 0 && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div className="section-title" style={{ marginBottom: 0 }}>My Tasks</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {stats.myTasks.length} task{stats.myTasks.length !== 1 ? 's' : ''} assigned to you
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.myTasks.slice(0, 8).map(task => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: getPriorityColor(task.priority),
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      flexShrink: 0,
                      minWidth: 40,
                    }}
                  >
                    {task.key}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {task.title}
                  </div>
                  <span className={getStatusBadgeClass(task.status)}>{task.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div className="section-title" style={{ marginBottom: 0 }}>Projects</div>
            <button className="btn btn-ghost btn-sm" onClick={onGoToProjects}>
              View All
            </button>
          </div>

          {projectsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : projects.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No projects found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.slice(0, 8).map(p => (
                <div
                  key={p.id}
                  onClick={() => onOpenProject(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onOpenProject(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 12,
                      color: 'var(--accent)',
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}
                  >
                    {(p.key || p.name || 'P').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 2,
                      }}
                    >
                      {p.name}
                    </div>
                    {p.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.description}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {projectTaskCounts[p.id] !== undefined
                      ? `${projectTaskCounts[p.id]} task${projectTaskCounts[p.id] !== 1 ? 's' : ''}`
                      : ''}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>›</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedProjectForCreate(defaultProject);
              setShowCreate(true);
            }}
            disabled={!defaultProject}
          >
            + Create Task
          </button>
          <button className="btn btn-outline" onClick={onGoToProjects}>
            View All Projects
          </button>
        </div>
      </div>

      {showCreate && selectedProjectForCreate && (
        <CreateTaskModal
          projectId={selectedProjectForCreate.id}
          initialStatus=""
          columns={statuses.map(s => ({ id: s.name, label: s.name, href: s.href }))}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
