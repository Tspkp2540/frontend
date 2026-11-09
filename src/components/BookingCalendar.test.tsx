import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingCalendar } from './BookingCalendar';
import { calendar, setup, teardown } from '../../test/support';
import type { CalendarData, DateRange } from '../lib/types';
import { roomPhoto } from '../lib/rooms';
beforeEach(setup);
afterEach(teardown);
function Calendar({
  data = calendar,
  loading = false,
  onChange = vi.fn(),
  onMonthChange = vi.fn(),
}: {
  data?: CalendarData;
  loading?: boolean;
  onChange?: (range: DateRange) => void;
  onMonthChange?: (month: Date) => void;
}) {
  const [range, setRange] = useState<DateRange>({ checkIn: '', checkOut: '' });
  return (
    <BookingCalendar
      data={data}
      month={new Date(2026, 10, 1, 12)}
      onMonthChange={onMonthChange}
      range={range}
      onChange={next => {
        setRange(next);
        onChange(next);
      }}
      loading={loading}
    />
  );
}
describe('calendar selection rules', () => {
  it('allows adjacent checkout, blocks occupied crossings and clears the selected range', async () => {
    const change = vi.fn();
    render(
      <Calendar
        data={{ ...calendar, bookedRanges: [{ checkIn: '2026-11-12', checkOut: '2026-11-14' }] }}
        onChange={change}
      />,
    );
    expect(screen.getByRole('button', { name: '7 พฤศจิกายน 2026' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '10 พฤศจิกายน 2026' }));
    expect(screen.getByRole('button', { name: '13 พฤศจิกายน 2026 มีผู้จองแล้ว' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '12 พฤศจิกายน 2026 มีผู้จองแล้ว' }));
    expect(change).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '2026-11-12' });
    await userEvent.click(screen.getByRole('button', { name: 'ล้างวันที่' }));
    expect(change).toHaveBeenLastCalledWith({ checkIn: '', checkOut: '' });
  });
  it('starts again when an earlier check-in is selected', async () => {
    const change = vi.fn();
    render(<Calendar onChange={change} />);
    await userEvent.click(screen.getByRole('button', { name: '10 พฤศจิกายน 2026' }));
    await userEvent.click(screen.getByRole('button', { name: '9 พฤศจิกายน 2026' }));
    expect(change).toHaveBeenLastCalledWith({ checkIn: '2026-11-09', checkOut: '' });
  });
  it('disables dates while fetching and dates beyond the advance limit', () => {
    const view = render(<Calendar loading />);
    expect(screen.getByRole('button', { name: '10 พฤศจิกายน 2026' })).toBeDisabled();
    expect(screen.getByText('กำลังตรวจวันว่าง…')).toBeVisible();
    view.rerender(
      <Calendar data={{ ...calendar, bookingRules: { maxAdvanceDays: 1, maxNights: 30 } }} />,
    );
    expect(screen.getByRole('button', { name: '10 พฤศจิกายน 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '9 พฤศจิกายน 2026' })).toBeEnabled();
  });
  it('explains full months and supports month navigation', async () => {
    const next = vi.fn();
    render(
      <Calendar
        onMonthChange={next}
        data={{ ...calendar, bookedRanges: [{ checkIn: '2026-11-08', checkOut: '2027-01-01' }] }}
      />,
    );
    expect(screen.getByText(/ไม่มีคืนว่างในช่วงที่แสดง/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    expect(next).toHaveBeenCalledWith(new Date(2026, 11, 1));
  });
  it('updates from one to two months when the responsive breakpoint changes', () => {
    let update!: () => void;
    const media = {
      matches: false,
      addEventListener: vi.fn((_name, callback) => {
        update = callback;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    const view = render(<Calendar />);
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    act(() => {
      media.matches = true;
      update();
    });
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    view.unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', update);
  });
  it('uses a local fallback image for rooms without presentation metadata', () => {
    expect(roomPhoto('unknown')).toBe('/images/main.jpg');
    expect(roomPhoto('7c71298a-ef46-457c-ab5e-9edb238a54e6')).toBe('/images/garden.jpg');
  });
});
