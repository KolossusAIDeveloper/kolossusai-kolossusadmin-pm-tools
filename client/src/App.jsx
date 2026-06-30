import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TokenGate from './components/TokenGate';
import ProjectPicker from './components/ProjectPicker';
import BoardView from './components/BoardView';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error?.status === 401 || error?.status === 403) return false;
        if (error?.status === 429) return failureCount < 3;
        return failureCount < 2;
      },
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, logout } = useAuth();
  const [selectedProject, setSelectedProject] = useState(null);

  if (!isAuthenticated) {
    return <TokenGate />;
  }

  if (!selectedProject) {
    return <ProjectPicker onSelect={setSelectedProject} />;
  }

  return (
    <BoardView
      project={selectedProject}
      onBack={() => setSelectedProject(null)}
    />
  );
}

// Global 401 handler — bounce back to token gate
function AuthGuard({ children }) {
  const { logout } = useAuth();

  React.useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        logout();
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
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
