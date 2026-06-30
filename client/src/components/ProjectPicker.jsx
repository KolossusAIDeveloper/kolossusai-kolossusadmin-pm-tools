import React from 'react';
import { useQuery } from '@tanstack/react-query';
import pm from '../api/pmClient';
import Navbar from './Navbar';

export default function ProjectPicker({ onSelect }) {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => pm.listProjects(),
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Projects</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          Select a project to open its board
        </p>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      )}

      {error && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Failed to load projects</div>
          <div className="empty-state-desc">{error.message}</div>
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No projects found</div>
          <div className="empty-state-desc">
            There are no projects available for this token.
          </div>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="projects-grid">
          {projects.map(p => (
            <div key={p.id} className="project-card" onClick={() => onSelect(p)}>
              <span className="project-key">{p.key}</span>
              <div className="project-name">{p.name}</div>
              {p.description && (
                <div className="project-desc">{p.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
