import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../lib/api';
import { saveBookingRequest, readBookingRequest } from '../lib/booking-request';
import {
  setup,
  teardown,
  mount,
  room,
  session,
  booking,
  calendar,
  deferred,
  offline,
} from '../../test/support';
beforeEach(setup);
afterEach(teardown);
const click = async (name: string) => userEvent.click(screen.getByRole('button', { name }));
async function open() {
  const view = mount(`/rooms/${room.id}`);
  await screen.findByLabelText('เบอร์โทรศัพท์');
  return view;
}
async function prepare() {
  fireEvent.change(screen.getByLabelText('วันเข้า', { exact: true }), {
    target: { value: '2026-11-10' },
  });
  fireEvent.change(screen.getByLabelText('วันออก', { exact: true }), {
    target: { value: '2026-11-12' },
  });
  fireEvent.change(screen.getByLabelText('เบอร์โทรศัพท์'), { target: { value: '0812345678' } });
  await click('ตรวจสอบการจอง');
  await screen.findByRole('dialog', { name: 'ยืนยันการจอง' });
}
describe('booking interactions and recovery', () => {
  it('cancels without writes then confirms and clears its stored key', async () => {
    await open();
    await prepare();
    await click('กลับไปแก้ไข');
    expect(api.book).not.toHaveBeenCalled();
    await click('ตรวจสอบการจอง');
    await click('ยืนยันการจอง');
    await acknowledgeSuccess();
    await screen.findByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' });
    expect(screen.queryByRole('button', { name: 'ตรวจสอบการจอง' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ดูวันว่าง' })).not.toBeInTheDocument();
    expect(api.book).toHaveBeenCalledWith(
      expect.objectContaining({ guestPhone: '+66812345678', roomId: room.id }),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(readBookingRequest(session.user.id, room.id)).toBeNull();
    await click('กลับไปดูปฏิทิน');
    expect(screen.queryByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeNull();
  });
  it('keeps the pending dialog locked and commits once', async () => {
    const pending = deferred<{ booking: typeof booking }>();
    vi.mocked(api.book).mockReturnValue(pending.promise);
    await open();
    await prepare();
    await click('ยืนยันการจอง');
    expect(screen.getByRole('button', { name: 'ยืนยันการจอง' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.pointerDown(document.querySelector('.modal-backdrop')!);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(api.book).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ booking }));
    await acknowledgeSuccess();
    await screen.findByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' });
  });
  it('preserves guest details and refreshes after a late conflict', async () => {
    vi.mocked(api.book).mockRejectedValue(new ApiError(409, 'BOOKING_CONFLICT', 'วันชน'));
    await open();
    await prepare();
    await click('ยืนยันการจอง');
    await screen.findByText(/ช่วงวันที่นี้เพิ่งถูกจองแล้ว/);
    expect(screen.getByLabelText('วันเข้า', { exact: true })).toHaveValue('');
    expect(screen.getByLabelText('เบอร์โทรศัพท์')).toHaveValue('0812345678');
    expect(readBookingRequest(session.user.id, room.id)).toBeNull();
    expect(api.calendar).toHaveBeenCalledTimes(2);
  });
  it('maps booking field errors without discarding the guest fields', async () => {
    vi.mocked(api.book).mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'ข้อมูลไม่ถูกต้อง', [
        { field: 'guestPhone', code: 'INVALID_FORMAT', message: 'ตรวจเบอร์อีกครั้ง' },
        { field: 'unknown', code: 'UNKNOWN_FIELD', message: 'unknown' },
      ]),
    );
    await open();
    await prepare();
    await click('ยืนยันการจอง');
    await screen.findByText('ตรวจเบอร์อีกครั้ง');
    expect(screen.getByLabelText('เบอร์โทรศัพท์')).toHaveValue('0812345678');
  });
  it('revalidates the latest calendar before sending a confirmed form', async () => {
    const { client } = await open();
    await prepare();
    act(() =>
      client.setQueryData(['calendar', room.id, calendar.from, calendar.to], {
        ...calendar,
        bookedRanges: [{ checkIn: '2026-11-10', checkOut: '2026-11-12' }],
      }),
    );
    await click('ยืนยันการจอง');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.book).not.toHaveBeenCalled();
    expect(screen.getAllByText(/ช่วงวันที่เลือกมีผู้จองแล้ว/).length).toBeGreaterThan(0);
  });
  it('checks uncertain outcomes, keeps 404 provisional, and replays the exact original payload', async () => {
    vi.mocked(api.book).mockRejectedValueOnce(offline());
    await open();
    await prepare();
    await click('ยืนยันการจอง');
    await screen.findByText(/ยังยืนยันผลการจองไม่ได้/);
    const first = vi.mocked(api.book).mock.calls[0];
    await click('ตรวจผลการจอง');
    await screen.findByText(/ยังไม่พบผลการจอง คำขอเดิมอาจกำลังประมวลผล/);
    fireEvent.change(screen.getByLabelText('เบอร์โทรศัพท์'), { target: { value: '0899999999' } });
    await click('ส่งคำขอเดิมอีกครั้ง');
    await acknowledgeSuccess();
    await screen.findByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' });
    expect(vi.mocked(api.book).mock.calls[1]).toEqual(first);
  });
  it('recovers a committed result by key and reports lookup network failures', async () => {
    vi.mocked(api.book).mockRejectedValue(offline());
    vi.mocked(api.bookingRequest)
      .mockRejectedValueOnce(offline())
      .mockResolvedValueOnce({ booking });
    await open();
    await prepare();
    await click('ยืนยันการจอง');
    await screen.findByText(/ยังยืนยันผลการจองไม่ได้/);
    await click('ตรวจผลการจอง');
    await screen.findByText('เชื่อมต่อไม่สำเร็จ');
    await click('ตรวจผลการจอง');
    await acknowledgeSuccess();
    await screen.findByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' });
    expect(api.book).toHaveBeenCalledTimes(1);
  });
  it('treats a reused-key mismatch as an outcome to look up', async () => {
    vi.mocked(api.book).mockRejectedValue(
      new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'ใช้ key ซ้ำ'),
    );
    await open();
    await prepare();
    await click('ยืนยันการจอง');
    await screen.findByText(/ยังยืนยันผลการจองไม่ได้/);
    expect(screen.getByRole('button', { name: 'ตรวจสอบการจอง' })).toBeDisabled();
  });
  it('keeps guest input when a month refresh fails and recovers on retry', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('เบอร์โทรศัพท์'), { target: { value: '0812345678' } });
    vi.mocked(api.calendar).mockRejectedValueOnce(offline());
    await click('เดือนถัดไป');
    await screen.findByRole('heading', { name: 'ตรวจวันว่างไม่สำเร็จ' });
    expect(screen.getByLabelText('เบอร์โทรศัพท์')).toHaveValue('0812345678');
    await click('ลองใหม่');
    await screen.findByText('เลือกวันเข้าพัก แล้วเลือกวันออก');
    expect(screen.getByLabelText('เบอร์โทรศัพท์')).toHaveValue('0812345678');
  });
  it('changes the visible month when dates are entered outside the current window', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('วันเข้า', { exact: true }), {
      target: { value: '2027-02-10' },
    });
    await waitFor(() =>
      expect(api.calendar).toHaveBeenCalledWith(
        room.id,
        '2027-02-01',
        '2027-04-01',
        expect.any(AbortSignal),
      ),
    );
  });
  it.each(['confirmed', 'cancelled'] as const)(
    'recovers saved %s receipts without another POST',
    async status => {
      saveBookingRequest(session.user.id, room.id, 'abcdef00-0000-4000-8000-000000000001');
      vi.mocked(api.bookingRequest).mockResolvedValue({ booking: { ...booking, status } });
      mount(`/rooms/${room.id}`);
      await screen.findByRole('heading', {
        name: status === 'cancelled' ? 'รายการจองนี้ถูกยกเลิกแล้ว' : 'บันทึกการจองเรียบร้อยแล้ว',
      });
      expect(api.book).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(readBookingRequest(session.user.id, room.id)).toBeNull();
    },
  );
  it('keeps a saved key through lookup errors and clears it only after a real result', async () => {
    const key = 'abcdef00-0000-4000-8000-000000000001';
    saveBookingRequest(session.user.id, room.id, key);
    const lookup = deferred<{ booking: typeof booking }>();
    vi.mocked(api.bookingRequest)
      .mockReturnValueOnce(lookup.promise)
      .mockRejectedValueOnce(offline())
      .mockResolvedValueOnce({ booking });
    mount(`/rooms/${room.id}`);
    await screen.findByText('กำลังตรวจผลคำขอจองก่อนหน้า…');
    await act(async () =>
      lookup.reject(new ApiError(404, 'BOOKING_REQUEST_NOT_FOUND', 'ยังไม่พบ')),
    );
    await screen.findByText(/ยังไม่พบผลการจอง ตรวจผลอีกครั้ง/);
    expect(readBookingRequest(session.user.id, room.id)).toBe(key);
    await click('ตรวจผลการจองอีกครั้ง');
    await screen.findByText(/ตรวจผลการจองไม่สำเร็จ:/);
    await click('ตรวจผลการจองอีกครั้ง');
    await screen.findByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' });
  });
});

async function acknowledgeSuccess() {
  expect(await screen.findByRole('dialog', { name: 'จองสำเร็จ' })).toHaveAccessibleDescription(
    'บันทึกการจองแล้ว ดูรายละเอียดได้ในใบยืนยันหรือหน้าการจองของฉัน',
  );
  await click('ตกลง');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
}
