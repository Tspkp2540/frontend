import { addDays, addMonths, differenceInCalendarDays, format, startOfMonth } from 'date-fns';
import { th } from 'date-fns/locale';
import type { CalendarData, DateRange } from './types';

// Only convert business dates to local calendar objects. Never serialize through toISOString().
export const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
export function fromKey(value: string): Date { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export const thaiDate = (value: string) => format(fromKey(value), 'd MMM yyyy', { locale: th });
export const nights = (range: DateRange) => differenceInCalendarDays(fromKey(range.checkOut), fromKey(range.checkIn));
export const shiftDate = (value: string, days: number) => dateKey(addDays(fromKey(value), days));
export const visibleWindow = (month: Date) => ({ from: dateKey(startOfMonth(month)), to: dateKey(addMonths(startOfMonth(month), 2)) });
export function bangkokToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function rangeError(range: DateRange, data: CalendarData): string | undefined {
  if (range.checkIn < data.today) return 'วันเข้าพักต้องไม่อยู่ในอดีต';
  if (range.checkIn > shiftDate(data.today, data.bookingRules.maxAdvanceDays)) return 'วันเข้าพักเกินช่วงที่เปิดให้จอง';
  if (nights(range) < 1) return 'วันออกต้องอยู่หลังวันเข้า';
  if (nights(range) > data.bookingRules.maxNights) return `พักได้สูงสุด ${data.bookingRules.maxNights} คืนต่อครั้ง`;
  if (range.checkIn < data.from || range.checkOut > data.to) return 'กรุณาเปิดเดือนที่ครอบคลุมวันเข้าและวันออกเพื่อตรวจวันว่าง';
  if (data.bookedRanges.some(b => range.checkIn < b.checkOut && range.checkOut > b.checkIn)) return 'ช่วงวันที่เลือกมีผู้จองแล้ว กรุณาเลือกวันว่างใหม่';
}
export const isBookedNight = (day: string, ranges: DateRange[]) => ranges.some(b => day >= b.checkIn && day < b.checkOut);
