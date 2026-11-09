import { useRef, useState } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { api, ApiError, errorMessage } from '../lib/api';
import { bangkokToday } from '../lib/dates';
import type { Booking, BookingPage } from '../lib/types';
import { Alert, Button, Modal } from './ui';
import { BookingSummary } from './BookingSummary';

export function CancelBooking({ booking }: { booking: Booking & { roomName: string } }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const sending = useRef(false);
  async function cancel() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api.cancelBooking(booking.id);
      client.setQueriesData<InfiniteData<BookingPage>>({ queryKey: ['my-bookings'] }, old =>
        old
          ? {
              ...old,
              pages: old.pages.map(page => ({
                ...page,
                bookings: page.bookings.map(item =>
                  item.id === booking.id ? { ...item, ...result.booking } : item,
                ),
              })),
            }
          : old,
      );
      setOpen(false);
      void client.invalidateQueries({ queryKey: ['calendar', booking.roomId] });
      void client.invalidateQueries({ queryKey: ['booking-request'] });
    } catch (error) {
      setError(
        error instanceof ApiError && error.status >= 400 && error.status < 500
          ? errorMessage(error)
          : `${errorMessage(error)} หากยังไม่ทราบผล คุณสามารถลองยกเลิกรายการเดิมอีกครั้งได้อย่างปลอดภัย`,
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  if (booking.status === 'cancelled') return null;
  if (booking.checkIn <= bangkokToday())
    return <p className="cancellation-note">พ้นกำหนดยกเลิกแล้ว</p>;
  return (
    <div className="cancellation-action">
      <Button
        variant="text"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        ยกเลิกการจอง
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title="ยกเลิกการจองนี้?"
        description="ยกเลิกแล้วจะคืนวันว่าง และเก็บรายการไว้ในประวัติ"
        actions={
          <>
            <Button variant="secondary" busy={busy} onClick={() => setOpen(false)}>
              เก็บการจองไว้
            </Button>
            <Button busy={busy} onClick={() => void cancel()}>
              ยืนยันยกเลิกการจอง
            </Button>
          </>
        }
      >
        <BookingSummary roomName={booking.roomName} booking={booking} />
        <p className="booking-reference">
          หมายเลขการจอง <code>{booking.id}</code>
        </p>
        {error && <Alert>{error}</Alert>}
      </Modal>
    </div>
  );
}
