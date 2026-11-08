import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { api, ApiError, errorMessage } from '../lib/api';
import { guestSchema, type GuestValues } from '../lib/validation';
import { nights, rangeError, shiftDate } from '../lib/dates';
import type { Booking, BookingInput, CalendarData, DateRange, Room } from '../lib/types';
import { Alert, Button, Modal, TextField } from './ui';
import { BookingSummary } from './BookingSummary';
import { clearBookingRequest, readBookingRequest, saveBookingRequest } from '../lib/booking-request';

export function BookingForm({ room, data, fetching, range, onChange, onBooked }: { room: Room; data: CalendarData; fetching: boolean; range: DateRange; onChange: (range: DateRange) => void; onBooked: (booking: Booking) => void }) {
  const { session } = useAuth(); const client = useQueryClient();
  const [pending, setPending] = useState<BookingInput | null>(null); const [message, setMessage] = useState(''); const sending = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const userId = session!.user.id;
  const requestKey = useRef<string | null>(readBookingRequest(userId, room.id));
  const attempted = useRef<BookingInput | null>(null);
  const [checking, setChecking] = useState(false);
  const form = useForm<GuestValues>({ resolver: zodResolver(guestSchema), defaultValues: { guestName: session?.user.fullName ?? '', guestEmail: session?.user.email ?? '', guestPhone: '' } });
  const complete = !!range.checkIn && !!range.checkOut;
  const dateError = complete ? rangeError(range, data) : undefined;
  const mutation = useMutation({ mutationFn: ({ body, key }: { body: BookingInput; key: string }) => api.book(body, key), retry: false });
  useEffect(() => { if (range.checkIn || range.checkOut) setMessage(''); }, [range.checkIn, range.checkOut]);
  async function prepare(values: GuestValues) {
    if (uncertain) return;
    if (!complete) { setMessage('กรุณาเลือกวันเข้าและวันออก'); return; }
    if (dateError || fetching) { setMessage(dateError ?? 'กรุณารอการตรวจวันว่าง'); return; }
    setMessage(''); setPending({ ...values, ...range, roomId: room.id });
  }
  async function finish(booking: Booking) {
    clearBookingRequest(userId, room.id); requestKey.current = null; attempted.current = null;
    setPending(null); setUncertain(false); setMessage('');
    await client.invalidateQueries({ queryKey: ['calendar', room.id] }); onBooked(booking);
  }
  async function checkResult() {
    if (!requestKey.current || sending.current) return;
    sending.current = true; setChecking(true); setMessage('');
    try { await finish((await api.bookingRequest(requestKey.current)).booking); }
    catch (error) { setMessage(error instanceof ApiError && error.code === 'BOOKING_REQUEST_NOT_FOUND' ? 'ยังไม่พบผลการจอง คำขอเดิมอาจกำลังประมวลผล ตรวจอีกครั้งหรือส่งคำขอเดิมซ้ำได้อย่างปลอดภัย' : errorMessage(error)); }
    finally { sending.current = false; setChecking(false); }
  }
  async function confirm(replay = false) {
    const body = replay ? attempted.current : pending;
    if (!body || sending.current || (!replay && fetching)) return;
    if (!replay) {
      const error = rangeError(body, data);
      if (error) { setPending(null); setMessage(error); return; }
    }
    const key = requestKey.current ?? crypto.randomUUID();
    requestKey.current = key; attempted.current = body; saveBookingRequest(userId, room.id, key);
    sending.current = true;
    try {
      const { booking } = await mutation.mutateAsync({ body, key });
      await finish(booking);
    } catch (error) {
      setPending(null);
      if (error instanceof ApiError && error.code === 'BOOKING_CONFLICT') {
        clearBookingRequest(userId, room.id); requestKey.current = null; attempted.current = null; setUncertain(false);
        onChange({ checkIn: '', checkOut: '' });
        await client.invalidateQueries({ queryKey: ['calendar', room.id] });
        setMessage('ช่วงวันที่นี้เพิ่งถูกจองแล้ว ปฏิทินอัปเดตให้แล้ว กรุณาเลือกวันใหม่');
      } else {
        if (error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.code === 'IDEMPOTENCY_KEY_REUSED')) setUncertain(true);
        if (error instanceof ApiError) for (const field of error.fields) if (['guestName', 'guestPhone', 'guestEmail'].includes(field.field)) form.setError(field.field as keyof GuestValues, { message: field.message });
        setMessage(errorMessage(error));
      }
    } finally { sending.current = false; }
  }
  return <aside className="reservation-panel" aria-label="ข้อมูลการจอง">
    <p className="eyebrow">YOUR STAY</p><h2>ข้อมูลการจอง</h2>
    <form noValidate onSubmit={form.handleSubmit(prepare)} className="stack-form">
      <div className="date-fields"><TextField label="วันเข้า" type="date" value={range.checkIn} min={data.today} max={shiftDate(data.today, data.bookingRules.maxAdvanceDays)} onChange={event => onChange({ checkIn: event.target.value, checkOut: range.checkOut > event.target.value ? range.checkOut : '' })} /><TextField label="วันออก" type="date" value={range.checkOut} min={range.checkIn ? shiftDate(range.checkIn, 1) : data.today} max={range.checkIn ? shiftDate(range.checkIn, data.bookingRules.maxNights) : undefined} onChange={event => onChange({ ...range, checkOut: event.target.value })} /></div>
      {dateError && <Alert>{dateError}</Alert>}
      <TextField label="ชื่อ-สกุลผู้เข้าพัก" autoComplete="name" {...form.register('guestName')} error={form.formState.errors.guestName?.message} />
      <TextField label="เบอร์โทรศัพท์" type="tel" autoComplete="tel" placeholder="+66812345678" hint="ใช้รหัสประเทศ เช่น +66 แทนเลข 0 ตัวแรก" {...form.register('guestPhone')} error={form.formState.errors.guestPhone?.message} />
      <TextField label="อีเมลผู้เข้าพัก" type="email" autoComplete="email" {...form.register('guestEmail')} error={form.formState.errors.guestEmail?.message} />
      <div className="stay-total"><span>ระยะเวลาเข้าพัก</span><strong>{complete && !dateError ? `${nights(range)} คืน` : 'ยังไม่ได้เลือกวัน'}</strong></div>
      {message && <Alert>{message}</Alert>}
      {uncertain && <Alert>ยังยืนยันผลการจองไม่ได้ รายการอาจถูกบันทึกแล้ว กรุณาตรวจผลก่อนทำรายการใหม่<Button type="button" variant="secondary" busy={checking} disabled={mutation.isPending} onClick={() => void checkResult()}>ตรวจผลการจอง</Button>{attempted.current && <Button type="button" variant="secondary" busy={mutation.isPending} disabled={checking} onClick={() => void confirm(true)}>ส่งคำขอเดิมอีกครั้ง</Button>}</Alert>}
      <Button type="submit" busy={mutation.isPending} disabled={uncertain || !complete || !!dateError || fetching}>ตรวจสอบการจอง<ArrowRight size={17} /></Button>
      <p className="reservation-note">ระบบจะตรวจวันว่างอีกครั้งก่อนบันทึก</p>
    </form>
    <Modal open={!!pending} onClose={() => setPending(null)} busy={mutation.isPending} title="ยืนยันการจอง" description="ตรวจสอบวันเข้าพักและข้อมูลผู้เข้าพักก่อนยืนยัน" actions={<><Button variant="secondary" onClick={() => setPending(null)} disabled={mutation.isPending}>กลับไปแก้ไข</Button><Button onClick={() => void confirm()} busy={mutation.isPending} disabled={fetching}>ยืนยันการจอง</Button></>}>
      {pending && <BookingSummary roomName={room.name} booking={pending} />}
    </Modal>
  </aside>;
}
