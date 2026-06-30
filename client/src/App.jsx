import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TokenGate from './components/TokenGate';
import ProjectPicker from './components/ProjectPicker';
import BoardView from './components/BoardView';
import './styles/index.css';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (failureCount, error) => error?.status === 401 || error?.status === 403 ? false : error?.status === 429 ? failureCount < 3 : failureCount < 2, staleTime: 30 * 1000 }, mutations: { retry: false } } });
function AppRoutes() { const { isAuthenticated } = useAuth(); const [selectedProject, setSelectedProject] = useState(null); useEffect(() => { if (!isAuthenticated) setSelectedProject(null); }, [isAuthenticated]); if (!isAuthenticated) return <TokenGate />; if (!selectedProject) return <ProjectPicker onSelect={setSelectedProject} />; return <BoardView project={selectedProject} onBack={() => setSelectedProject(null)} />; }
function AuthGuard({ children }) { const { logout } = useAuth(); useEffect(() => { const originalFetch = window.fetch; window.fetch = async (...args) => { const res = await originalFetch(...args); if (res.status === 401) logout(); return res; }; return () => { window.fetch = originalFetch; }; }, [logout]); return children; }
export default function App() { return <QueryClientProvider client={queryClient}><AuthProvider><AuthGuard><AppRoutes /></AuthGuard></AuthProvider></QueryClientProvider>; }
