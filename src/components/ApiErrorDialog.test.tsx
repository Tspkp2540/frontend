import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiErrorDialog } from './ApiErrorDialog';
import { api, ApiError } from '../lib/api';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('queues different errors and restores the recovery action when the opener disappears', async () => {
  const view = render(
    <>
      <button data-error-focus>ตรวจผลการจอง</button>
      <ApiErrorDialog />
    </>,
  );
  act(() => {
    window.dispatchEvent(
      new CustomEvent('api-error', {
        detail: new ApiError(0, 'NETWORK_ERROR', 'ตรวจสอบอินเทอร์เน็ต'),
      }),
    );
    window.dispatchEvent(
      new CustomEvent('api-error', {
        detail: new ApiError(429, 'RATE_LIMITED', 'รอสักครู่', [], 30),
      }),
    );
  });
  expect(screen.getByRole('dialog', { name: 'เชื่อมต่อไม่สำเร็จ' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'ตกลง' }));
  expect(screen.getByRole('dialog', { name: 'ทำรายการถี่เกินไป' })).toHaveAccessibleDescription(
    'ทำรายการถี่เกินไป กรุณารอ 30 วินาทีแล้วลองใหม่',
  );
  fireEvent.click(screen.getByRole('button', { name: 'ตกลง' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'ตรวจผลการจอง' })).toHaveFocus());
});

it('shows API error title and description, closes with OK and permits retry', async () => {
  const fetch = vi.fn().mockImplementation(
    () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
          },
        }),
        { status: 401 },
      ),
  );
  vi.stubGlobal('fetch', fetch);
  render(<ApiErrorDialog />);
  const login = () => api.login({ email: 'test@example.com', password: 'wrong-password' });
  await act(async () => {
    await expect(login()).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
  expect(screen.getByRole('dialog', { name: 'เข้าสู่ระบบไม่สำเร็จ' })).toHaveAccessibleDescription(
    'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  );
  fireEvent.click(screen.getByRole('button', { name: 'ตกลง' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(async () => {
    await expect(login()).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('deduplicates simultaneous failures and sanitizes server errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'INTERNAL_ERROR', message: 'SQL secret stack trace' },
          }),
          { status: 500 },
        ),
    ),
  );
  render(<ApiErrorDialog />);
  await act(async () => {
    await Promise.allSettled([api.rooms(), api.rooms()]);
  });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
    'ระบบไม่สามารถดำเนินการได้ กรุณาลองใหม่',
  );
  expect(screen.queryByText(/SQL secret/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ตกลง' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not show errors for signed-out checks, pending lookups or caller cancellation', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'BOOKING_REQUEST_NOT_FOUND' } }), {
          status: 404,
        }),
      )
      .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError')),
  );
  render(<ApiErrorDialog />);
  await act(async () => {
    await expect(api.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(api.bookingRequest('key')).rejects.toMatchObject({
      code: 'BOOKING_REQUEST_NOT_FOUND',
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      api.calendar('id', '2026-11-01', '2026-12-01', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
