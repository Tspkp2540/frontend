import { describe, it, expect, vi } from 'vitest';
import {
  bangkokToday,
  dateKey,
  fromKey,
  isBookedNight,
  nights,
  rangeError,
  shiftDate,
  visibleWindow,
} from './dates';
import { guestSchema, registerSchema } from './validation';
import type { CalendarData } from './types';
const data: CalendarData = {
  roomId: 'room',
  timezone: 'Asia/Bangkok',
  today: '2026-11-08',
  bookingRules: { maxNights: 30, maxAdvanceDays: 365 },
  from: '2026-11-01',
  to: '2027-01-01',
  bookedRanges: [{ checkIn: '2026-11-15', checkOut: '2026-11-18' }],
};
describe('booking date rules', () => {
  it('keeps business date strings independent of UTC serialization', () => {
    expect(dateKey(fromKey('2026-11-08'))).toBe('2026-11-08');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(nights({ checkIn: '2026-12-31', checkOut: '2027-01-02' })).toBe(2);
  });
  it('uses a two-month query window within API limits', () => {
    expect(visibleWindow(fromKey('2026-11-08'))).toEqual({ from: '2026-11-01', to: '2027-01-01' });
  });
  it.each([
    ['2026-11-13', '2026-11-15'],
    ['2026-11-18', '2026-11-20'],
    ['2026-11-08', '2026-11-09'],
  ])('allows adjacent/free range %s–%s', (checkIn, checkOut) => {
    expect(rangeError({ checkIn, checkOut }, data)).toBeUndefined();
  });
  it.each([
    ['2026-11-14', '2026-11-16'],
    ['2026-11-14', '2026-11-19'],
    ['2026-11-16', '2026-11-17'],
  ])('rejects overlapping range %s–%s', (checkIn, checkOut) => {
    expect(rangeError({ checkIn, checkOut }, data)).toContain('มีผู้จองแล้ว');
  });
  it('blocks past, equal/reversed, overlong and unchecked date windows', () => {
    expect(rangeError({ checkIn: '2026-11-07', checkOut: '2026-11-08' }, data)).toContain('อดีต');
    expect(rangeError({ checkIn: '2026-11-10', checkOut: '2026-11-10' }, data)).toContain(
      'หลังวันเข้า',
    );
    expect(rangeError({ checkIn: '2026-11-10', checkOut: '2026-12-11' }, data)).toContain('30');
    expect(rangeError({ checkIn: '2027-11-09', checkOut: '2027-11-10' }, data)).toContain(
      'ช่วงที่เปิด',
    );
    expect(rangeError({ checkIn: '2027-01-01', checkOut: '2027-01-02' }, data)).toContain(
      'ครอบคลุม',
    );
  });
  it('treats checkout as available and checkin as occupied', () => {
    expect(isBookedNight('2026-11-15', data.bookedRanges)).toBe(true);
    expect(isBookedNight('2026-11-18', data.bookedRanges)).toBe(false);
  });
  it('accepts exactly the maximum nights and rejects one additional night', () => {
    const free = { ...data, bookedRanges: [] };
    expect(rangeError({ checkIn: '2026-11-08', checkOut: '2026-12-08' }, free)).toBeUndefined();
    expect(rangeError({ checkIn: '2026-11-08', checkOut: '2026-12-09' }, free)).toContain('30');
  });
  it('accepts the exact advance limit but rejects the next day', () => {
    const future = { ...data, from: '2027-11-01', to: '2028-01-01', bookedRanges: [] };
    expect(rangeError({ checkIn: '2027-11-08', checkOut: '2027-11-09' }, future)).toBeUndefined();
    expect(rangeError({ checkIn: '2027-11-09', checkOut: '2027-11-10' }, future)).toContain(
      'ช่วงที่เปิด',
    );
  });
  it('allows checkout on the query exclusive end but not an unchecked night beyond it', () => {
    expect(rangeError({ checkIn: '2026-12-30', checkOut: '2027-01-01' }, data)).toBeUndefined();
    expect(rangeError({ checkIn: '2026-12-30', checkOut: '2027-01-02' }, data)).toContain(
      'ครอบคลุม',
    );
  });
});
describe('client validation', () => {
  it('rejects NUL names and international phone input', () => {
    expect(
      guestSchema.safeParse({
        guestName: 'A\u0000B',
        guestPhone: '+66812345678',
        guestEmail: 'a@example.com',
      }).success,
    ).toBe(false);
    expect(
      guestSchema.safeParse({
        guestName: 'Name',
        guestPhone: '+66812345678',
        guestEmail: 'a@example.com',
      }).success,
    ).toBe(false);
  });
  it('normalizes fields but preserves password spaces and Unicode lengths', () => {
    const password = '  secure-password  ';
    expect(
      registerSchema.parse({ fullName: ' Name ', email: ' TEST@example.com ', password }),
    ).toEqual({ fullName: 'Name', email: 'test@example.com', password });
    expect(
      registerSchema.safeParse({
        fullName: 'Name',
        email: 'test@example.com',
        password: '😀'.repeat(12),
      }).success,
    ).toBe(true);
  });
});

it('reports the Bangkok date correctly at UTC midnight boundaries', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-12-31T17:00:00Z'));
  expect(bangkokToday()).toBe('2027-01-01');
  vi.useRealTimers();
});
