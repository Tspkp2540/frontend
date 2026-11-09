import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { api, errorMessage } from '../lib/api';
import { Alert, Button, PageState } from '../components/ui';
import { BookingSummary } from '../components/BookingSummary';
import { CancelBooking } from '../components/CancelBooking';

export function MyBookingsPage() {
  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ['my-bookings', session!.user.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.myBookings(pageParam, signal),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const bookings = query.data?.pages.flatMap(page => page.bookings) ?? [];
  return (
    <div className="content-wrap bookings-page">
      <div className="page-heading">
        <div>
          <h1>
            การจองของฉัน<span className="brand-dot">.</span>
          </h1>
        </div>
        <Link className="button button-secondary" to="/rooms">
          จองห้องพักเพิ่ม
        </Link>
      </div>
      {query.isPending ? (
        <PageState title="กำลังโหลดการจอง…" />
      ) : !query.data ? (
        <PageState title="โหลดการจองไม่สำเร็จ" retry={() => query.refetch()}>
          {errorMessage(query.error)}
        </PageState>
      ) : !bookings.length ? (
        <PageState title="คุณยังไม่มีรายการจอง">
          <Link to="/rooms">เลือกห้องพักและตรวจวันว่าง</Link>
        </PageState>
      ) : (
        <>
          <div className="booking-history">
            {bookings.map(booking => (
              <article className="history-item" key={booking.id}>
                <div className="history-heading">
                  <h2>{booking.roomName}</h2>
                  <span role="status" className={`booking-status status-${booking.status}`}>
                    {booking.status === 'confirmed' ? 'ยืนยันการจองแล้ว' : 'ยกเลิกแล้ว'}
                  </span>
                </div>
                <BookingSummary roomName={booking.roomName} booking={booking} showRoom={false} />
                <dl className="booking-summary">
                  <div>
                    <dt>อีเมล</dt>
                    <dd>{booking.guestEmail}</dd>
                  </div>
                  <div>
                    <dt>โทรศัพท์</dt>
                    <dd>{booking.guestPhone}</dd>
                  </div>
                </dl>
                <p className="booking-reference">
                  หมายเลขการจอง <code>{booking.id}</code>
                </p>
                <CancelBooking booking={booking} />
              </article>
            ))}
          </div>
          {query.isError && (
            <Alert>
              {errorMessage(query.error)}{' '}
              <Button
                variant="text"
                onClick={() =>
                  void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                }
                busy={query.isFetching}
              >
                ลองใหม่
              </Button>
            </Alert>
          )}
          {query.hasNextPage && !query.isFetchNextPageError && (
            <div className="history-more">
              <Button
                variant="secondary"
                busy={query.isFetching}
                onClick={() => void query.fetchNextPage()}
              >
                โหลดรายการเพิ่มเติม
              </Button>
            </div>
          )}
          {!query.hasNextPage && <p className="history-end">แสดงรายการครบแล้ว</p>}
        </>
      )}
    </div>
  );
}
