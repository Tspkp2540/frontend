import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/500.css';
import '@fontsource/noto-sans-thai/600.css';
import 'react-day-picker/style.css';
import './styles.css';
import { AuthProvider, ProtectedRoute } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { ApiErrorDialog } from './components/ApiErrorDialog';
import { AuthPage } from './pages/AuthPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { RoomsPage } from './pages/RoomsPage';
import { AppErrorBoundary, PageState } from './components/ui';
const RoomPage = React.lazy(async () => {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      import('./pages/RoomPage').then(module => ({ default: module.RoomPage })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Page load timeout')), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
});

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15000 }, mutations: { retry: false } },
});
function RoomRoute() {
  const { roomId } = useParams();
  return (
    <React.Suspense fallback={<PageState title="กำลังโหลดปฏิทิน…" />}>
      <RoomPage key={roomId} />
    </React.Suspense>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <ApiErrorDialog />
          <AuthProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/login" element={<AuthPage key="login" />} />
                <Route path="/register" element={<AuthPage key="register" register />} />
                <Route
                  path="/my-bookings"
                  element={
                    <ProtectedRoute>
                      <MyBookingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rooms"
                  element={
                    <ProtectedRoute>
                      <RoomsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rooms/:roomId"
                  element={
                    <ProtectedRoute>
                      <RoomRoute />
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/rooms" replace />} />
                <Route
                  path="*"
                  element={
                    <PageState title="ไม่พบหน้าที่คุณต้องการ">
                      <a href="/rooms">กลับไปหน้าห้องพัก</a>
                    </PageState>
                  }
                />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
