import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <div className="navbar">
      <div className="navbar-brand">
        <div className="avatar">PM</div>
        <div>
          <div>PM Tools</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Jira-style workspace</div>
        </div>
      </div>
      <div className="navbar-right">
        {user && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.name}</div>}
        <button className="btn btn-ghost" onClick={logout}>Disconnect</button>
      </div>
    </div>
  );
}
