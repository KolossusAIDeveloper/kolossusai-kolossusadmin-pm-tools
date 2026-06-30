import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TokenGate from './components/TokenGate';
import Dashboard from './components/Dashboard';
import ProjectPicker from './components/ProjectPicker';
import BoardView from './components/BoardView';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        error?.status === 401 || error?.status === 403
          ? false
          : error?.status === 429
          ? failureCount < 3
          : failureCount < 2,
      staleTime: 30 * 1000,
    },
    mutations: { retry: false },
  },
});

// view: 'dashboard' | 'projects' | 'board'
function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState('dashboard');
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSelectedProject(null);
      setView('dashboard');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return <TokenGate />;

  if (view === 'dashboard') {
    return (
      <Dashboard
        onGoToProjects={() => setView('projects')}
        onOpenProject={project => {
          setSelectedProject(project);
          setView('board');
        }}
      />
    );
  }

  if (view === 'projects') {
    return (
      <ProjectPicker
        onSelect={project => {
          setSelectedProject(project);
          setView('board');
        }}
        onDashboard={() => setView('dashboard')}
      />
    );
  }

  if (view === 'board' && selectedProject) {
    return (
      <BoardView
        project={selectedProject}
        onBack={() => setView('projects')}
        onDashboard={() => setView('dashboard')}
      />
    );
  }

  return (
    <Dashboard
      onGoToProjects={() => setView('projects')}
      onOpenProject={project => {
        setSelectedProject(project);
        setView('board');
      }}
    />
  );
}

function AuthGuard({ children }) {
  const { logout } = useAuth();

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) logout();
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGuard>
          <AppRoutes />
        </AuthGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}
