import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearBookingRequest, readBookingRequest, saveBookingRequest } from './booking-request';
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
describe('booking request recovery storage', () => {
  it('stores only the UUID and isolates owners and rooms', () => {
    saveBookingRequest('a', 'room', 'abcdef00-0000-4000-8000-000000000001');
    expect(sessionStorage.getItem('booking-request:a:room')).toBe(
      'abcdef00-0000-4000-8000-000000000001',
    );
    expect(readBookingRequest('b', 'room')).toBeNull();
    expect(readBookingRequest('a', 'other')).toBeNull();
    clearBookingRequest('a', 'room');
    expect(readBookingRequest('a', 'room')).toBeNull();
  });
  it('ignores corrupted saved keys', () => {
    sessionStorage.setItem('booking-request:bad:room', 'broken');
    expect(readBookingRequest('bad', 'room')).toBeNull();
  });
  it('still supports in-app recovery if storage access is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    saveBookingRequest('blocked', 'room', 'abcdef00-0000-4000-8000-000000000001');
    expect(readBookingRequest('blocked', 'room')).toBe('abcdef00-0000-4000-8000-000000000001');
    clearBookingRequest('blocked', 'room');
    expect(readBookingRequest('blocked', 'room')).toBeNull();
  });
});
