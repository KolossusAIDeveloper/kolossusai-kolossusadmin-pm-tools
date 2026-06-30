import React from 'react';
import { useAuth } from '../contexts/AuthContext';

function initials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Navbar({ onDashboard, onProjects, currentView }) {
  const { user, logout } = useAuth();

  return (
    <div className="navbar">
      {/* Brand */}
      <div
        className="navbar-brand"
        style={{ cursor: onDashboard ? 'pointer' : 'default' }}
        onClick={onDashboard}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 13,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          PM
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>PM Tools</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
            Ocius Workspace
          </div>
        </div>
      </div>

      {/* Nav links */}
      {onProjects && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{
              color:
                currentView === 'dashboard' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom:
                currentView === 'dashboard' ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: 6,
            }}
            onClick={onDashboard}
          >
            Dashboard
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{
              color:
                currentView === 'projects' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom:
                currentView === 'projects' ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: 6,
            }}
            onClick={onProjects}
          >
            Projects
          </button>
        </div>
      )}

      {/* Right section */}
      <div className="navbar-right">
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className="assignee-avatar"
              style={{
                width: 30,
                height: 30,
                fontSize: 11,
                background: 'var(--accent-dim)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              {initials(user.name)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {user.name}
            </div>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Disconnect
        </button>
      </div>
    </div>
  );
}
