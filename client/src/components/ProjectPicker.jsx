import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import pm from '../api/pmClient';
import Navbar from './Navbar';

export default function ProjectPicker({ onSelect, onDashboard }) {
  const [search, setSearch] = useState('');

  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => pm.listProjects(),
    staleTime: 60 * 1000,
  });

  const filtered = projects.filter(
    p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.key || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}
    >
      <Navbar onDashboard={onDashboard} onProjects={() => {}} currentView="projects" />

      <div
        style={{
          padding: '28px',
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          flex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            >
              All Projects
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Select a project to view its board and tasks.
            </div>
          </div>
          {!isLoading && projects.length > 0 && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '6px 14px',
                fontWeight: 600,
              }}
            >
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 24, position: 'relative', maxWidth: 360 }}>
          <input
            className="input"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
          <span
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              fontSize: 15,
            }}
          >
            &#128269;
          </span>
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
            <div className="empty-state-title">Failed to load projects</div>
            <div className="empty-state-desc">{error.message}</div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => refetch()}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">&#128230;</div>
            <div className="empty-state-title">
              {search ? 'No projects match your search' : 'No projects found'}
            </div>
            <div className="empty-state-desc">
              {search
                ? 'Try a different search term.'
                : 'There are no projects available for this token.'}
            </div>
            {search && (
              <button
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => setSearch('')}
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="projects-grid">
            {filtered.map(p => (
              <div key={p.id} className="project-card" onClick={() => onSelect(p)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                      color: 'var(--accent)',
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}
                  >
                    {(p.key || p.name || 'P').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="project-key">{p.key}</div>
                    <div className="project-name">{p.name}</div>
                  </div>
                </div>
                {p.description && (
                  <div
                    className="project-desc"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {p.description}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    Open Board
                  </span>
                  <span style={{ color: 'var(--accent)', fontSize: 14 }}>›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
