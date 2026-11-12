import { z } from 'zod';
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'อีเมลยาวเกินกำหนด')
  .email('กรุณากรอกอีเมลให้ถูกต้อง');
const password = z
  .string()
  .refine(v => [...v].length >= 12 && [...v].length <= 128, 'รหัสผ่านต้องมี 12–128 ตัวอักษร');
const name = z
  .string()
  .trim()
  .refine(
    v => [...v].length >= 1 && [...v].length <= 150 && !v.includes('\u0000'),
    'กรุณากรอกชื่อ 1–150 ตัวอักษร',
  );
export const loginSchema = z.object({ email, password });
export const registerSchema = loginSchema.extend({ fullName: name });
export const guestSchema = z.object({
  guestName: name,
  guestEmail: email,
  guestPhone: z
    .string()
    .trim()
    .regex(/^0[0-9]{9}$/, 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก เริ่มต้นด้วย 0'),
});
export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type GuestValues = z.infer<typeof guestSchema>;
