import { useEffect, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { th } from 'react-day-picker/locale';
import { addMonths, format } from 'date-fns';
import { dateKey, fromKey, isBookedNight, rangeError, shiftDate } from '../lib/dates';
import type { CalendarData, DateRange } from '../lib/types';
import { Button } from './ui';

export function BookingCalendar({ data, month, onMonthChange, range, onChange, loading }: { data: CalendarData; month: Date; onMonthChange: (month: Date) => void; range: DateRange; onChange: (range: DateRange) => void; loading: boolean }) {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  useEffect(() => { const media = window.matchMedia('(min-width: 1100px)'); const update = () => setWide(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const choosingCheckout = !!range.checkIn && !range.checkOut;
  const end = dateKey(addMonths(month, wide ? 2 : 1));
  let hasFreeNight = false;
  for (let key = dateKey(month); key < end; key = shiftDate(key, 1)) {
    if (key >= data.today && key <= shiftDate(data.today, data.bookingRules.maxAdvanceDays) && !isBookedNight(key, data.bookedRanges)) { hasFreeNight = true; break; }
  }
  const selected = range.checkIn ? { from: fromKey(range.checkIn), to: range.checkOut > range.checkIn ? fromKey(range.checkOut) : undefined } : undefined;
  const disabled = (day: Date) => {
    const key = dateKey(day);
    if (loading || key < data.today) return true;
    if (choosingCheckout && key > range.checkIn) return !!rangeError({ checkIn: range.checkIn, checkOut: key }, data);
    return key > shiftDate(data.today, data.bookingRules.maxAdvanceDays) || isBookedNight(key, data.bookedRanges);
  };
  return <div className="booking-calendar" aria-busy={loading}>
    {!loading && !hasFreeNight && <p className="calendar-guidance" role="status">ไม่มีคืนว่างในช่วงที่แสดง ลองเปลี่ยนเดือนหรือเลือกห้องอื่น</p>}
    <DayPicker mode="range" selected={selected} onSelect={() => undefined} month={month} onMonthChange={onMonthChange} numberOfMonths={wide ? 2 : 1}
      locale={th} weekStartsOn={0} startMonth={fromKey(data.today)} endMonth={fromKey(shiftDate(data.today, data.bookingRules.maxAdvanceDays + data.bookingRules.maxNights))}
      disabled={disabled} modifiers={{ booked: day => isBookedNight(dateKey(day), data.bookedRanges) }} modifiersClassNames={{ booked: 'calendar-booked' }}
      onDayClick={(day, modifiers) => {
        if (modifiers.disabled) return;
        const key = dateKey(day);
        if (choosingCheckout && key > range.checkIn) onChange({ checkIn: range.checkIn, checkOut: key });
        else onChange({ checkIn: key, checkOut: '' });
      }}
      labels={{ labelNext: () => 'เดือนถัดไป', labelPrevious: () => 'เดือนก่อนหน้า', labelDayButton: (day, modifiers) => `${format(day, 'd MMMM yyyy', { locale: th })}${modifiers.booked ? ' มีผู้จองแล้ว' : ''}${modifiers.selected ? ' เลือกแล้ว' : ''}` }}
      formatters={{ formatCaption: date => format(date, 'MMMM yyyy', { locale: th }) }} />
    <div className="calendar-footer"><span><i className="legend-booked" />ขีดทับ = มีผู้จองแล้ว</span><Button variant="text" onClick={() => onChange({ checkIn: '', checkOut: '' })} disabled={!range.checkIn && !range.checkOut}>ล้างวันที่</Button></div>
    <p className="calendar-guidance" role="status">{loading ? 'กำลังตรวจวันว่าง…' : choosingCheckout ? 'เลือกวันออก — สามารถเลือกวันเริ่มของการจองถัดไปเป็นวันออกได้' : range.checkOut ? 'เลือกช่วงวันแล้ว ตรวจสอบข้อมูลก่อนยืนยัน' : 'เลือกวันเข้าพัก แล้วเลือกวันออก'}</p>
  </div>;
}
