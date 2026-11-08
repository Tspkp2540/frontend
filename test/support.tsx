import { render, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { api, ApiError } from '../src/lib/api';
import { AuthProvider, ProtectedRoute } from '../src/auth/AuthProvider';
import { AuthPage } from '../src/pages/AuthPage';
import { RoomsPage } from '../src/pages/RoomsPage';
import { RoomPage } from '../src/pages/RoomPage';
import { Layout } from '../src/components/Layout';
import { clearBookingRequest } from '../src/lib/booking-request';
import type { Booking, CalendarData, Session } from '../src/lib/types';
export const room = { id: '7c71298a-ef46-457c-ab5e-9edb238a54e5', name: 'บ้านพักหลัก' };
export const session: Session = { user: { id: '10000000-0000-4000-8000-000000000001', fullName: 'ผู้ทดสอบ', email: 'test@example.com', createdAt: '2026-11-01T00:00:00Z' }, sessionExpiresAt: '2026-11-15T00:00:00Z' };
export const calendar: CalendarData = { roomId: room.id, timezone: 'Asia/Bangkok', today: '2026-11-08', from: '2026-11-01', to: '2027-01-01', bookingRules: { maxNights: 30, maxAdvanceDays: 365 }, bookedRanges: [] };
export const booking: Booking = { id: '20000000-0000-4000-8000-000000000001', roomId: room.id, checkIn: '2026-11-10', checkOut: '2026-11-12', guestName: session.user.fullName, guestEmail: session.user.email, guestPhone: '+66812345678', nights: 2, status: 'confirmed', createdAt: '2026-11-08T00:00:00Z' };
export const offline = () => new ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อไม่สำเร็จ');
export const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
export function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes,no) => { resolve=yes; reject=no; }); return {promise,resolve,reject}; }
const clients: QueryClient[] = [];
export function setup() {
  vi.useFakeTimers({toFake:['Date']}); vi.setSystemTime(new Date('2026-11-08T05:00:00Z'));
  clearBookingRequest(session.user.id,room.id); sessionStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  vi.spyOn(api,'me').mockResolvedValue(session); vi.spyOn(api,'rooms').mockResolvedValue({rooms:[room]});
  vi.spyOn(api,'calendar').mockImplementation(async(_id,from,to)=>({...calendar,from,to}));
  vi.spyOn(api,'login').mockResolvedValue(session); vi.spyOn(api,'register').mockResolvedValue({user:session.user}); vi.spyOn(api,'logout').mockResolvedValue(undefined);
  vi.spyOn(api,'book').mockResolvedValue({booking}); vi.spyOn(api,'bookingRequest').mockRejectedValue(new ApiError(404,'BOOKING_REQUEST_NOT_FOUND','ยังไม่พบผล'));
}
export function teardown() { cleanup(); for(const client of clients.splice(0))client.clear(); clearBookingRequest(session.user.id,room.id); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); }
export function mount(path='/rooms', state?: unknown) {
  const client = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity,staleTime:Infinity},mutations:{retry:false}}}); clients.push(client);
  const view=render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{pathname:path,state}]}><AuthProvider><Routes><Route element={<Layout/>}>
    <Route path="/login" element={<AuthPage key="login"/>}/><Route path="/register" element={<AuthPage key="register" register/>}/>
    <Route path="/rooms" element={<ProtectedRoute><RoomsPage/></ProtectedRoute>}/><Route path="/rooms/:roomId" element={<ProtectedRoute><RoomPage/></ProtectedRoute>}/>
  </Route></Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
  return {...view,client};
}
