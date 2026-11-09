export type User = { id: string; email: string; fullName: string; createdAt: string };
export type Session = { user: User; sessionExpiresAt: string };
export type Room = { id: string; name: string; hotelName: string; province: string };
export type DateRange = { checkIn: string; checkOut: string };
export type Rules = { maxNights: number; maxAdvanceDays: number };
export type CalendarData = {
  roomId: string;
  timezone: string;
  today: string;
  bookingRules: Rules;
  from: string;
  to: string;
  bookedRanges: DateRange[];
};
export type BookingInput = DateRange & {
  roomId: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
};
export type Booking = BookingInput & {
  id: string;
  nights: number;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
};
export type FieldError = { field: string; code: string; message: string };

export type BookingPage = {
  bookings: Array<Booking & { roomName: string }>;
  nextCursor: string | null;
};
