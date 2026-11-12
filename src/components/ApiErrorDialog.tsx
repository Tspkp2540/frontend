import { useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../lib/api';
import { Button, Modal } from './ui';

const titles: Record<string, string> = {
  VALIDATION_ERROR: 'ตรวจสอบข้อมูลอีกครั้ง',
  INVALID_CREDENTIALS: 'เข้าสู่ระบบไม่สำเร็จ',
  EMAIL_ALREADY_EXISTS: 'อีเมลนี้ถูกใช้งานแล้ว',
  BOOKING_CONFLICT: 'วันที่เลือกถูกจองแล้ว',
  CANCELLATION_NOT_ALLOWED: 'ไม่สามารถยกเลิกการจองได้',
  RATE_LIMITED: 'ทำรายการถี่เกินไป',
  NETWORK_ERROR: 'เชื่อมต่อไม่สำเร็จ',
  TIMEOUT: 'การเชื่อมต่อใช้เวลานานเกินไป',
};

/** One application-level dialog; existing page recovery and field errors remain available. */
export function ApiErrorDialog() {
  const [errors, setErrors] = useState<ApiError[]>([]);
  useEffect(() => {
    const receive = (event: Event) => {
      const error = (event as CustomEvent<ApiError>).detail;
      if (!(error instanceof ApiError)) return;
      setErrors(old => (old.some(item => item.code === error.code) ? old : [...old, error]));
    };
    window.addEventListener('api-error', receive);
    return () => window.removeEventListener('api-error', receive);
  }, []);
  const error = errors[0];
  const close = () => setErrors(old => old.slice(1));
  return (
    <Modal
      open={!!error}
      onClose={close}
      fallbackFocus={() => document.querySelector<HTMLElement>('[data-error-focus]:not(:disabled)')}
      title={error ? (titles[error.code] ?? 'ไม่สามารถดำเนินการได้') : ''}
      description={error ? errorMessage(error) : ''}
      actions={<Button onClick={close}>ตกลง</Button>}
    />
  );
}
