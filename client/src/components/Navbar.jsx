import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar({ onBack, backLabel }) {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        PM Tools
      </div>
      <div className="navbar-right">
        {user && (
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {user.name || user.email || 'Connected'}
          </span>
        )}
        <div className="avatar" title={user?.name}>
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initials}
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 13, padding: '4px 10px' }} onClick={logout}>
          Disconnect
        </button>
      </div>
    </nav>
  );
}
