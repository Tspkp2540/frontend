import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, errorMessage } from '../lib/api';
import { clearBookingRequest, readBookingRequest } from '../lib/booking-request';
import type { Booking } from '../lib/types';
import { Alert, Button } from './ui';

export function BookingRecovery({ userId, roomId, onRecovered }: { userId: string; roomId: string; onRecovered: (booking: Booking) => void }) {
  const [key] = useState(() => readBookingRequest(userId, roomId));
  const query = useQuery({ queryKey: ['booking-request', userId, key], queryFn: () => api.bookingRequest(key!), enabled: !!key, retry: false, staleTime: 0 });
  useEffect(() => {
    if (query.data) { clearBookingRequest(userId, roomId); onRecovered(query.data.booking); }
  }, [query.data, userId, roomId, onRecovered]);
  if (!key) return null;
  return <section className="booking-recovery" aria-live="polite"><Alert tone="info">
    {query.isPending ? 'กำลังตรวจผลคำขอจองก่อนหน้า…' : query.error instanceof ApiError && query.error.code === 'BOOKING_REQUEST_NOT_FOUND'
      ? 'ยังไม่พบผลการจอง คำขอเดิมอาจกำลังประมวลผล ตรวจผลอีกครั้งหรือกรอกข้อมูลเดิมเพื่อลองส่งอีกครั้ง ระบบใช้รหัสคำขอเดิมเพื่อป้องกันรายการซ้ำ'
      : query.isError ? `ตรวจผลการจองไม่สำเร็จ: ${errorMessage(query.error)}` : 'พบผลการจองแล้ว'}
    <Button type="button" variant="secondary" busy={query.isFetching} onClick={() => void query.refetch()}>ตรวจผลการจองอีกครั้ง</Button>
  </Alert></section>;
}
