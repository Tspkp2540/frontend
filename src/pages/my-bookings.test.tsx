import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api, ApiError } from '../lib/api';
import {
  setup,
  teardown,
  mount,
  booking,
  room,
  deferred,
  offline,
  unauthorized,
} from '../../test/support';
beforeEach(setup);
afterEach(teardown);
const item = { ...booking, roomName: room.name };
it('shows loading then empty history with a link to rooms', async () => {
  const pending = deferred<{ bookings: (typeof item)[]; nextCursor: null }>();
  vi.mocked(api.myBookings).mockReturnValue(pending.promise);
  mount('/my-bookings');
  expect(await screen.findByText('กำลังโหลดการจอง…')).toBeVisible();
  pending.resolve({ bookings: [], nextCursor: null });
  expect(await screen.findByText('คุณยังไม่มีรายการจอง')).toBeVisible();
  await userEvent.click(screen.getByRole('link', { name: 'เลือกห้องพักและตรวจวันว่าง' }));
  expect(await screen.findByRole('heading', { name: /เลือกห้องพัก/ })).toBeVisible();
});
it('retries a failed initial request and renders accurate confirmed and cancelled records', async () => {
  vi.mocked(api.myBookings)
    .mockRejectedValueOnce(offline())
    .mockResolvedValue({
      bookings: [
        item,
        { ...item, id: '20000000-0000-4000-8000-000000000002', status: 'cancelled' },
      ],
      nextCursor: null,
    });
  mount('/my-bookings');
  expect(await screen.findByText('โหลดการจองไม่สำเร็จ')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
  expect(await screen.findByText('ยืนยันการจองแล้ว')).toBeVisible();
  expect(screen.getByText('ยกเลิกแล้ว')).toBeVisible();
  expect(screen.getAllByText(item.guestEmail)).toHaveLength(2);
  expect(screen.getAllByText(item.guestPhone)).toHaveLength(2);
  expect(screen.getByText('แสดงรายการครบแล้ว')).toBeVisible();
});
it('retains loaded records when load more fails, then retries the same cursor', async () => {
  vi.mocked(api.myBookings)
    .mockResolvedValueOnce({ bookings: [item], nextCursor: item.id })
    .mockRejectedValueOnce(offline())
    .mockResolvedValue({
      bookings: [{ ...item, id: '20000000-0000-4000-8000-000000000002' }],
      nextCursor: null,
    });
  mount('/my-bookings');
  await userEvent.click(await screen.findByRole('button', { name: 'โหลดรายการเพิ่มเติม' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('เชื่อมต่อไม่สำเร็จ');
  expect(screen.getByText(item.id)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
  expect(await screen.findByText('แสดงรายการครบแล้ว')).toBeVisible();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(
    vi
      .mocked(api.myBookings)
      .mock.calls.slice(1)
      .every(call => call[0] === item.id),
  ).toBe(true);
});
it('supports successful pagination and navigation from the header', async () => {
  vi.mocked(api.myBookings)
    .mockResolvedValueOnce({ bookings: [item], nextCursor: item.id })
    .mockResolvedValue({ bookings: [], nextCursor: null });
  mount();
  await userEvent.click(await screen.findByRole('link', { name: 'การจองของฉัน' }));
  expect(screen.getByRole('link', { name: 'การจองของฉัน' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await userEvent.click(await screen.findByRole('button', { name: 'โหลดรายการเพิ่มเติม' }));
  expect(await screen.findByText('แสดงรายการครบแล้ว')).toBeVisible();
});
it('protects history from signed-out access', async () => {
  vi.mocked(api.me).mockRejectedValue(unauthorized());
  mount('/my-bookings');
  expect(await screen.findByRole('heading', { name: /เข้าสู่ระบบ/ })).toBeVisible();
  await waitFor(() => expect(api.myBookings).not.toHaveBeenCalled());
});

it('keeps existing history visible if refreshing fails and retries the refresh', async () => {
  vi.mocked(api.myBookings)
    .mockResolvedValueOnce({ bookings: [item], nextCursor: null })
    .mockRejectedValueOnce(offline())
    .mockResolvedValue({ bookings: [item], nextCursor: null });
  const { client } = mount('/my-bookings');
  await screen.findByText(item.id);
  await client.invalidateQueries({ queryKey: ['my-bookings'] });
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByText(item.id)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('confirms cancellation, updates the row and clears calendar/recovery caches', async () => {
  vi.mocked(api.myBookings).mockResolvedValue({ bookings: [item], nextCursor: null });
  const { client } = mount('/my-bookings');
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await userEvent.click(await screen.findByRole('button', { name: 'ยกเลิกการจอง' }));
  expect(screen.getByRole('dialog', { name: 'ยกเลิกการจองนี้?' })).toHaveTextContent(item.roomName);
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันยกเลิกการจอง' }));
  expect(await screen.findByText('ยกเลิกแล้ว')).toBeVisible();
  expect(api.cancelBooking).toHaveBeenCalledWith(item.id);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['calendar', item.roomId] });
});
it('allows dismissing cancellation without sending and hides action after cutoff', async () => {
  vi.mocked(api.myBookings).mockResolvedValue({
    bookings: [item, { ...item, id: 'past', checkIn: '2026-11-08' }],
    nextCursor: null,
  });
  mount('/my-bookings');
  await userEvent.click(await screen.findByRole('button', { name: 'ยกเลิกการจอง' }));
  await userEvent.click(screen.getByRole('button', { name: 'เก็บการจองไว้' }));
  expect(api.cancelBooking).not.toHaveBeenCalled();
  expect(screen.getByText(/พ้นกำหนดยกเลิกแล้ว/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'ยกเลิกการจอง' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps cancellation open on an unknown result, blocks duplicates and retries safely', async () => {
  vi.mocked(api.myBookings).mockResolvedValue({ bookings: [item], nextCursor: null });
  const pending = deferred<{ booking: typeof booking }>();
  vi.mocked(api.cancelBooking)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue({ booking: { ...booking, status: 'cancelled' } });
  mount('/my-bookings');
  await userEvent.click(await screen.findByRole('button', { name: 'ยกเลิกการจอง' }));
  await userEvent.dblClick(screen.getByRole('button', { name: 'ยืนยันยกเลิกการจอง' }));
  expect(api.cancelBooking).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'เก็บการจองไว้' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeVisible();
  pending.reject(offline());
  expect(await screen.findByRole('alert')).toHaveTextContent('ลองยกเลิกรายการเดิมอีกครั้ง');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันยกเลิกการจอง' }));
  expect(await screen.findByText('ยกเลิกแล้ว')).toBeVisible();
});

it('shows a known cancellation rejection without suggesting that the result is unknown', async () => {
  vi.mocked(api.myBookings).mockResolvedValue({ bookings: [item], nextCursor: null });
  vi.mocked(api.cancelBooking).mockRejectedValue(
    new ApiError(409, 'CANCELLATION_NOT_ALLOWED', 'ยกเลิกได้ก่อนวันเข้าพักเท่านั้น'),
  );
  mount('/my-bookings');
  await userEvent.click(await screen.findByRole('button', { name: 'ยกเลิกการจอง' }));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันยกเลิกการจอง' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('ยกเลิกได้ก่อนวันเข้าพักเท่านั้น');
  expect(screen.getByRole('alert')).not.toHaveTextContent('ยังไม่ทราบผล');
  expect(screen.getByText('ยืนยันการจองแล้ว')).toBeVisible();
});
