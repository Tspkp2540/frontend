import { nights, thaiDate } from '../lib/dates';
import type { BookingInput } from '../lib/types';

export function BookingSummary({ roomName, booking }: { roomName: string; booking: BookingInput }) {
  return <dl className="booking-summary"><div><dt>ห้องพัก</dt><dd>{roomName}</dd></div><div><dt>วันเข้า</dt><dd>{thaiDate(booking.checkIn)}</dd></div><div><dt>วันออก</dt><dd>{thaiDate(booking.checkOut)}</dd></div><div><dt>ระยะเวลา</dt><dd>{nights(booking)} คืน</dd></div><div><dt>ผู้เข้าพัก</dt><dd>{booking.guestName}</dd></div></dl>;
}
