import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const user = z.object({ id: z.string(), fullName: z.string(), email: z.string(), createdAt: z.string() });
const range = z.object({ checkIn: date, checkOut: date });
export const responses = {
  session: z.object({ user, sessionExpiresAt: z.string() }),
  register: z.object({ user }),
  rooms: z.object({ rooms: z.array(z.object({ id: z.string(), name: z.string(), hotelName:z.string(), province:z.string() })) }),
  calendar: z.object({ roomId: z.string(), timezone: z.string(), today: date, from: date, to: date, bookingRules: z.object({ maxNights: z.number().int().positive(), maxAdvanceDays: z.number().int().nonnegative() }), bookedRanges: z.array(range) }),
  booking: z.object({ booking: range.extend({ id: z.string(), roomId: z.string(), guestName: z.string(), guestPhone: z.string(), guestEmail: z.string(), nights: z.number().int().positive(), status: z.enum(['confirmed', 'cancelled']), createdAt: z.string() }) }),
};


export const bookingPageResponse = z.object({ bookings: z.array(responses.booking.shape.booking.extend({roomName:z.string()})), nextCursor:z.uuid().nullable() });
