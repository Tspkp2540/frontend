const m=(target,id,file,before,after,description,tests)=>({target,id,file,before,after,description,tests});
const booking=['tests/booking.test.ts'],auth=['tests/auth.test.ts'],calendar=['tests/calendar.test.ts'];
const dates=['src/lib/dates.test.ts'],flows=['src/pages/flows.test.tsx'],bookFlows=['src/pages/booking-flows.test.tsx'];
export const mutations=[
 m('frontend','FE-CANCEL-01','src/components/CancelBooking.tsx','item.id === booking.id','false','Fail to update the cancelled booking status',['src/pages/my-bookings.test.tsx']),
 m('frontend','FE-DATE-01','src/lib/dates.ts','range.checkIn < data.today','range.checkIn <= data.today','Reject check-in today',dates),
 m('frontend','FE-DATE-02','src/lib/dates.ts','nights(range) < 1','nights(range) < 0','Allow zero-night stay',dates),
 m('frontend','FE-DATE-03','src/lib/dates.ts','nights(range) > data.bookingRules.maxNights','nights(range) >= data.bookingRules.maxNights','Reject exact maximum nights',dates),
 m('frontend','FE-DATE-04','src/lib/dates.ts','range.checkIn < b.checkOut && range.checkOut > b.checkIn','range.checkIn <= b.checkOut && range.checkOut >= b.checkIn','Treat touching checkout boundaries as occupied',dates),
 m('frontend','FE-DATE-05','src/lib/dates.ts','day < b.checkOut','day <= b.checkOut','Mark checkout as an occupied night',dates),
 m('frontend','FE-DATE-06','src/lib/dates.ts',"timeZone: 'Asia/Bangkok'","timeZone: 'UTC'",'Use UTC instead of business timezone',dates),
 m('frontend','FE-DATE-07','src/lib/dates.ts','range.checkIn > shiftDate(data.today, data.bookingRules.maxAdvanceDays)','range.checkIn >= shiftDate(data.today, data.bookingRules.maxAdvanceDays)','Reject exact advance-day limit',dates),
 m('frontend','FE-DATE-08','src/lib/dates.ts','range.checkOut > data.to','range.checkOut >= data.to','Reject checkout on the query exclusive end',dates),
 m('frontend','FE-AUTH-01','src/auth/AuthProvider.tsx','if (!session) return <Navigate','if (false) return <Navigate','Allow an anonymous protected route',flows),
 m('frontend','FE-AUTH-02','src/auth/AuthProvider.tsx',"client.removeQueries({ predicate: query => query.queryKey[0] !== 'session' });",'void 0;','Retain private cached data after session expiry',flows),
 m('frontend','FE-KEY-01','src/components/BookingForm.tsx','const key = requestKey.current ?? crypto.randomUUID();','const key = crypto.randomUUID();','Generate a different key on retry',bookFlows),
 m('frontend','FE-KEY-02','src/components/BookingForm.tsx','const body = replay ? attempted.current : pending;',"const body = replay ? { ...attempted.current!, guestPhone: form.getValues('guestPhone') } : pending;",'Replay edited fields instead of the original payload',bookFlows),
 m('frontend','FE-KEY-03','src/components/BookingRecovery.tsx','if (query.data) { clearBookingRequest(userId, roomId);','if (query.data) { void 0;','Keep the saved key after recovering a committed booking',bookFlows),
];
