import { expect, it } from 'vitest';
import { guestSchema } from './validation';

it.each(['0812345678', '0212345678', ' 0898765432 '])(
  'accepts a ten-digit local phone: %s',
  guestPhone => {
    expect(
      guestSchema.parse({ guestName: 'Guest', guestEmail: 'guest@example.com', guestPhone })
        .guestPhone,
    ).toBe(guestPhone.trim());
  },
);
it.each([
  '',
  '081234567',
  '08123456789',
  '+66812345678',
  '1812345678',
  '081-234567',
  '๐๘๑๒๓๔๕๖๗๘',
  'abcdefghij',
])('rejects an invalid local phone: %s', guestPhone => {
  expect(
    guestSchema.safeParse({ guestName: 'Guest', guestEmail: 'guest@example.com', guestPhone })
      .success,
  ).toBe(false);
});
