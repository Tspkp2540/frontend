import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, CalendarDays } from 'lucide-react';
import { startOfMonth } from 'date-fns';
import { api, errorMessage } from '../lib/api';
import { bangkokToday, fromKey, thaiDate, visibleWindow } from '../lib/dates';
import { roomPhoto } from '../lib/rooms';
import type { Booking, CalendarData, DateRange } from '../lib/types';
import { Alert, Button, PageState, RoomImage, Skeleton } from '../components/ui';
import { BookingCalendar } from '../components/BookingCalendar';
import { BookingForm } from '../components/BookingForm';
import { BookingSummary } from '../components/BookingSummary';
import { BookingRecovery } from '../components/BookingRecovery';
import { useAuth } from '../auth/AuthProvider';

export function RoomPage() {
  const { session } = useAuth();
  const { roomId = '' } = useParams();
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: api.rooms }); const room = rooms.data?.rooms.find(room => room.id === roomId);
  const [month, setMonth] = useState(() => startOfMonth(fromKey(bangkokToday())));
  const [range, setRange] = useState<DateRange>({ checkIn: '', checkOut: '' }); const [receipt, setReceipt] = useState<Booking | null>(null);
  const window = visibleWindow(month);
  const calendar = useQuery({ queryKey: ['calendar', roomId, window.from, window.to], queryFn: ({ signal }) => api.calendar(roomId, window.from, window.to, signal), enabled: !!room, placeholderData: keepPreviousData });
  const lastCalendar = useRef<CalendarData | undefined>(undefined);
  useEffect(() => { if (calendar.data) lastCalendar.current = calendar.data; }, [calendar.data]);
  const formData = calendar.data ?? (lastCalendar.current?.roomId === roomId ? lastCalendar.current : undefined);
  function choose(next: DateRange) {
    setReceipt(null); setRange(next);
    if (next.checkIn && (next.checkIn < window.from || next.checkIn >= window.to)) setMonth(startOfMonth(fromKey(next.checkIn)));
  }
  if (rooms.isPending) return <div className="content-wrap"><Skeleton className="detail-skeleton" /></div>;
  if (rooms.isError) return <PageState title="โหลดห้องพักไม่สำเร็จ" retry={() => rooms.refetch()}>{errorMessage(rooms.error)}</PageState>;
  if (!room) return <PageState title="ไม่พบห้องที่เปิดรับจอง" retry={() => rooms.refetch()}><Link to="/rooms">กลับไปเลือกห้องพัก</Link></PageState>;
  return <div className="content-wrap detail-page">
    <Link to="/rooms" className="back-link"><ArrowLeft size={15} />ห้องพักทั้งหมด</Link>
    <div className="detail-heading"><div><p className="eyebrow">MAKE ROOM FOR A SLOWER DAY</p><h1>{room.name}</h1><p className="intro">เลือกวันที่ แล้วให้เวลาพักเป็นของคุณ</p></div><a href="#availability" className="availability-link">ดูวันว่าง<ArrowUpRight size={17} /></a></div>
    <div className="detail-gallery"><RoomImage className="gallery-main" src={roomPhoto(room.id)} alt={`ภาพประกอบ ${room.name}`} /><div className="gallery-side"><span>YOUR NEXT<br />QUIET MOMENT.</span><p>เลือกวันว่างของคุณ<br />แล้วพบกันที่บ้านพัก</p><small>ภาพห้องพักใช้ประกอบการสาธิต</small></div></div>
    {receipt ? <section className="receipt" role="status" aria-live="polite" tabIndex={-1} ref={element => { element?.focus(); }}><p className="eyebrow">BOOKING CONFIRMED</p><h2>{receipt.status === "cancelled" ? "รายการจองนี้ถูกยกเลิกแล้ว" : "บันทึกการจองเรียบร้อยแล้ว"}</h2><p className="intro">เก็บหมายเลขการจองไว้สำหรับอ้างอิง</p><BookingSummary roomName={room.name} booking={receipt} /><p className="booking-reference">หมายเลขการจอง <code>{receipt.id}</code></p><Button variant="secondary" onClick={() => { setReceipt(null); setRange({ checkIn: '', checkOut: '' }); }}>กลับไปดูปฏิทิน</Button></section> : null}
    {!receipt && session && <BookingRecovery userId={session.user.id} roomId={room.id} onRecovered={booking => { setReceipt(booking); setRange({ checkIn: '', checkOut: '' }); }} />}
    <div className="booking-layout" id="availability">
      <section className="availability-section"><div className="section-heading"><div><p className="eyebrow">AVAILABILITY</p><h2>เลือกวันเข้าพัก</h2><p>{range.checkIn ? range.checkOut ? `${thaiDate(range.checkIn)} – ${thaiDate(range.checkOut)}` : `วันเข้า ${thaiDate(range.checkIn)} · เลือกวันออก` : 'วันพักดี ๆ เริ่มจากวันที่ว่าง'}</p></div><CalendarDays size={23} strokeWidth={1.3} /></div>
        {calendar.isPending ? <Skeleton className="calendar-skeleton" /> : calendar.isError ? <PageState title="ตรวจวันว่างไม่สำเร็จ" retry={() => calendar.refetch()}>{errorMessage(calendar.error)}</PageState> : <>
          {calendar.isFetching && <p className="refresh-status" role="status">กำลังอัปเดตวันว่าง…</p>}
          <BookingCalendar data={calendar.data} month={month} onMonthChange={setMonth} range={range} onChange={choose} loading={calendar.isFetching} />
          <section className="stay-information"><h3>ก่อนเข้าพัก</h3><ul><li>พักได้สูงสุด {calendar.data.bookingRules.maxNights} คืนต่อครั้ง</li><li>เลือกวันเข้าพักล่วงหน้าได้ {calendar.data.bookingRules.maxAdvanceDays} วัน</li><li>วันออกเปิดให้ผู้เข้าพักถัดไปจองต่อได้</li></ul></section>
        </>}
      </section>
      {formData && <BookingForm key={`${room.id}:${receipt?.id ?? "new"}`} room={room} data={formData} fetching={calendar.isFetching || calendar.isError} range={range} onChange={choose} onBooked={booking => { setReceipt(booking); setRange({ checkIn: '', checkOut: '' }); }} />}
    </div>
    {calendar.isError && <Alert tone="info">ยังไม่สามารถยืนยันการจองได้จนกว่าจะตรวจวันว่างสำเร็จ หรือ <Link to="/rooms">กลับไปเลือกห้องพัก</Link></Alert>}
  </div>;
}


