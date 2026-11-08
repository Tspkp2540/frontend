import type { Booking, BookingInput, CalendarData, FieldError, Room, Session, User } from './types';
import type { ZodType } from 'zod';
import { responses } from './responses';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: FieldError[] = [], public retryAfter?: number) { super(message); }
}
export async function request<T>(path: string, options: RequestInit = {}, schema?: ZodType<T>): Promise<T> {
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), 15000);
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}${path}`, {
      ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal,
      credentials: 'include', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
    if (response.status === 204 && !schema) return undefined as T;
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && body?.error?.code === 'UNAUTHORIZED') window.dispatchEvent(new Event('session-expired'));
      const retry = Number(response.headers.get('Retry-After'));
      const fields = Array.isArray(body?.error?.fields) ? body.error.fields.filter((field: FieldError) => field && typeof field.field === 'string' && typeof field.message === 'string') : [];
      throw new ApiError(response.status, typeof body?.error?.code === 'string' ? body.error.code : 'INTERNAL_ERROR', typeof body?.error?.message === 'string' ? body.error.message : 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่', fields, retry > 0 ? retry : undefined);
    }
    if (!body || typeof body !== 'object' || !('data' in body) || (schema && !schema.safeParse(body.data).success)) throw new ApiError(502, 'INVALID_RESPONSE', 'ได้รับข้อมูลไม่สมบูรณ์ กรุณาลองใหม่');
    return body.data as T;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timeout.signal.aborted) throw new ApiError(0, 'TIMEOUT', 'รอนานเกินไป กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  } finally { window.clearTimeout(timer); }
}
export const api = {
  me: () => request<Session>('/auth/me', {}, responses.session),
  register: (body: { fullName: string; email: string; password: string }) => request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }, responses.register),
  login: (body: { email: string; password: string }) => request<Session>('/auth/login', { method: 'POST', body: JSON.stringify(body) }, responses.session),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  rooms: () => request<{ rooms: Room[] }>('/rooms', {}, responses.rooms),
  calendar: (id: string, from: string, to: string, signal?: AbortSignal) => request<CalendarData>(`/rooms/${encodeURIComponent(id)}/calendar?${new URLSearchParams({ from, to })}`, { signal }, responses.calendar),
  book: (body: BookingInput, key: string) => request<{ booking: Booking }>('/bookings', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, responses.booking),
  bookingRequest: (key: string) => request<{ booking: Booking }>(`/bookings/requests/${encodeURIComponent(key)}`, {}, responses.booking),
};
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.code === 'RATE_LIMITED' && error.retryAfter ? `ทำรายการถี่เกินไป กรุณารอ ${error.retryAfter} วินาทีแล้วลองใหม่` : error.message;
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}
