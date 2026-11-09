import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api, ApiError, errorMessage } from '../lib/api';
import type { Session } from '../lib/types';
import { Button, Modal, PageState } from '../components/ui';

type AuthContextValue = { session: Session | null | undefined; pending: boolean; setSession: (session: Session) => void; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient(); const navigate = useNavigate(); const [expired, setExpired] = useState(false);
  const query = useQuery({ queryKey: ['session'], queryFn: async () => { try { return await api.me(); } catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; } }, retry: false, staleTime: 30000 });
  useEffect(() => {
    const handler = () => {
      if (client.getQueryData<Session | null>(['session'])) {
        client.removeQueries({ predicate: query => query.queryKey[0] !== 'session' });
        client.setQueryData(['session'], null); setExpired(true);
      }
    };
    window.addEventListener('session-expired', handler); return () => window.removeEventListener('session-expired', handler);
  }, [client]);
  const value: AuthContextValue = {
    session: query.data, pending: query.isPending,
    setSession: session => { client.clear(); client.setQueryData(['session'], session); setExpired(false); },
    logout: async () => { await api.logout(); client.clear(); client.setQueryData(['session'], null); navigate('/login', { replace: true }); },
  };
  return <AuthContext.Provider value={value}>
    {query.isError ? <PageState title="ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ" retry={() => query.refetch()}>{errorMessage(query.error)}</PageState> : children}
    <Modal open={expired} onClose={() => { setExpired(false); navigate('/login', { replace: true }); }} title="กรุณาเข้าสู่ระบบอีกครั้ง" description="การเข้าสู่ระบบหมดอายุแล้ว กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ" actions={<Button onClick={() => { setExpired(false); navigate('/login', { replace: true }); }}>เข้าสู่ระบบ</Button>} />
  </AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, pending } = useAuth(); const location = useLocation();
  if (pending) return <PageState title="กำลังตรวจสอบการเข้าสู่ระบบ…" />;
  if (!session) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return children;
}

