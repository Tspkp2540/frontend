import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const password = 'review-password-123';
let today: string;
const next = (value: string, days: number) => new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);

test.beforeEach(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Run npm run test:system to use the isolated test database');
  await pool.query('TRUNCATE bookings,sessions,users,rate_limit_buckets CASCADE');
  today = (await pool.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date::text AS today")).rows[0].today;
});
test.afterAll(async () => { await pool.end(); });
async function registerLogin(page: Page, email = 'review@example.com') {
  await page.goto('/register'); await page.getByLabel('ชื่อ-สกุล', { exact: true }).fill('ผู้ตรวจระบบ'); await page.getByLabel('อีเมล', { exact: true }).fill(email); await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password); await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/); await page.getByLabel('อีเมล', { exact: true }).fill(email); await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password); await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'เลือกห้องพัก.' })).toBeVisible();
}
async function openRoom(page: Page) { await page.getByRole('link', { name: /บ้านพักหลัก/ }).click(); await expect(page.getByRole('heading', { name: 'เลือกวันเข้าพัก' })).toBeVisible(); await expect(page.getByText('เลือกวันเข้าพัก แล้วเลือกวันออก', { exact: true })).toBeVisible(); }
async function fillBooking(page: Page, from = next(today, 2), to = next(today, 4)) {
  await page.getByLabel('วันเข้า', { exact: true }).fill(from); await page.getByLabel('วันออก', { exact: true }).fill(to);
  await page.getByLabel('เบอร์โทรศัพท์', { exact: true }).fill('+66812345678');
  await page.getByRole('button', { name: 'ตรวจสอบการจอง', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'ยืนยันการจอง' })).toBeVisible();
}

test('protected pages, inline login errors, five rooms, real photos and logout', async ({ page }) => {
  await page.goto('/rooms'); await expect(page).toHaveURL(/\/login$/);
  await registerLogin(page); await expect(page.locator('.room-item')).toHaveCount(5);
  for(const image of await page.locator('.room-image img').all()) { await image.scrollIntoViewIfNeeded(); await expect.poll(()=>image.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0); }
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('อีเมล', { exact: true }).fill('review@example.com'); await page.getByLabel('รหัสผ่าน', { exact: true }).fill('wrong-password-123'); await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('booking confirmation commits once, shows receipt and updates calendar without affecting another room', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click(); await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
  const rows = (await pool.query('SELECT b.*,u.email FROM bookings b JOIN users u ON u.id=b.user_id')).rows; expect(rows).toHaveLength(1); expect(rows[0].email).toBe('review@example.com');
  await page.getByRole('button', { name: 'กลับไปดูปฏิทิน' }).click(); await page.reload(); await expect(page.locator('.calendar-booked')).toHaveCount(2);
  await page.getByRole('link', { name: 'ห้องพักทั้งหมด', exact: true }).click(); await page.getByRole('link', { name: /ห้องสวน/ }).click(); await expect(page.locator('.calendar-booked')).toHaveCount(0);
});
test('late conflict refreshes availability, preserves guest input and asks for new dates', async ({ page, request }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  const origin = process.env.BASE_URL!;
  await request.post('/api/v1/auth/register', { headers: { origin }, data: { email: 'other@example.com', password, fullName: 'Other' } });
  await request.post('/api/v1/auth/login', { headers: { origin }, data: { email: 'other@example.com', password } });
  const result = await request.post('/api/v1/bookings', { headers: { origin }, data: { roomId: '7c71298a-ef46-457c-ab5e-9edb238a54e5', checkIn: next(today, 2), checkOut: next(today, 4), guestName: 'Other Guest', guestPhone: '+66812345678', guestEmail: 'other@example.com' } }); expect(result.status()).toBe(201);
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('เพิ่งถูกจองแล้ว'); await expect(page.getByLabel('เบอร์โทรศัพท์', { exact: true })).toHaveValue('+66812345678'); await expect(page.getByLabel('วันเข้า', { exact: true })).toHaveValue('');
  expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
});
test('session expiry shows the shared dialog and redirects to login', async ({ page }) => {
  await registerLogin(page); await openRoom(page);
  await pool.query("UPDATE sessions SET created_at=CURRENT_TIMESTAMP-INTERVAL '8 days',expires_at=CURRENT_TIMESTAMP-INTERVAL '1 day'");
  await page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'กรุณาเข้าสู่ระบบอีกครั้ง' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
});
test('calendar allows checkout on the next booking start and disables crossing occupied nights',async({page})=>{
  await registerLogin(page);
  const owner=(await pool.query('SELECT id FROM users')).rows[0].id;
  await pool.query("INSERT INTO bookings(user_id,room_id,check_in,check_out,guest_name,guest_phone,guest_email) VALUES($1,'7c71298a-ef46-457c-ab5e-9edb238a54e5',$2,$3,'Existing Guest','+66812345678','existing@example.com')",[owner,next(today,5),next(today,7)]);
  await openRoom(page);
  const dayLabel=(key:string)=>format(new Date(key+'T12:00:00'),'d MMMM yyyy',{locale:th});
  await page.getByRole('button',{name:dayLabel(next(today,2)),exact:true}).click();
  await expect(page.getByRole('button',{name:dayLabel(next(today,6))+' มีผู้จองแล้ว',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:dayLabel(next(today,5))+' มีผู้จองแล้ว',exact:true}).click();
  await expect(page.getByLabel('วันเข้า',{exact:true})).toHaveValue(next(today,2));
  await expect(page.getByLabel('วันออก',{exact:true})).toHaveValue(next(today,5));
  await page.getByLabel('เบอร์โทรศัพท์',{exact:true}).fill('+66812345678');
  await page.getByRole('button',{name:'ตรวจสอบการจอง',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'ยืนยันการจอง'})).toBeVisible();
  await page.getByRole('button',{name:'ยืนยันการจอง',exact:true}).click();
  await expect(page.getByRole('heading',{name:'บันทึกการจองเรียบร้อยแล้ว'})).toBeVisible();
  expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('2');
});
test('mobile layout fits the viewport and modal closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await registerLogin(page); await openRoom(page); await fillBooking(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button',{name:'ตรวจสอบการจอง',exact:true})).toBeFocused(); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('0');
  await page.screenshot({ path: 'test-results/mobile-room.png', fullPage: true });
});

test('failed calendar refresh preserves guest input and blocks booking until retry succeeds', async ({ page }) => {
  await registerLogin(page); await openRoom(page);
  await page.getByLabel('เบอร์โทรศัพท์', { exact: true }).fill('+66812345678');
  await page.route('**/api/v1/rooms/*/calendar?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Temporary failure' } }) }));
  await page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ตรวจวันว่างไม่สำเร็จ' })).toBeVisible();
  await expect(page.getByLabel('เบอร์โทรศัพท์', { exact: true })).toHaveValue('+66812345678');
  await expect(page.getByRole('button', { name: 'ตรวจสอบการจอง', exact: true })).toBeDisabled();
  await page.unroute('**/api/v1/rooms/*/calendar?*');
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ตรวจวันว่างไม่สำเร็จ' })).toHaveCount(0);
  await expect(page.getByLabel('เบอร์โทรศัพท์', { exact: true })).toHaveValue('+66812345678');
  expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('0');
});

test('session lookup failure shows retry and recovers', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.abort('failed'));
  await page.goto('/rooms');
  await expect(page.getByRole('heading', { name: 'ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ' })).toBeVisible();
  await page.unroute('**/api/v1/auth/me'); await page.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

for (const mode of ['network', 'server', 'malformed'] as const) {
  test(`room list ${mode} failure shows retry and recovers`, async ({ page }) => {
    await registerLogin(page);
    await page.route('**/api/v1/rooms', route => mode === 'network' ? route.abort('failed') : route.fulfill({ status: mode === 'server' ? 503 : 200, contentType: 'application/json', body: mode === 'server' ? 'Service unavailable' : JSON.stringify({ data: { rooms: null } }) }));
    await page.reload(); await expect(page.getByRole('heading', { name: 'โหลดห้องพักไม่สำเร็จ' })).toBeVisible();
    await page.unroute('**/api/v1/rooms'); await page.getByRole('button', { name: 'ลองใหม่' }).click();
    await expect(page.locator('.room-item')).toHaveCount(5);
  });
}

test('empty room list can refresh to available rooms', async ({ page }) => {
  await registerLogin(page);
  await page.route('**/api/v1/rooms', route => route.fulfill({ json: { data: { rooms: [] } } }));
  await page.reload(); await expect(page.getByRole('heading', { name: 'ยังไม่มีห้องที่เปิดรับจอง' })).toBeVisible();
  await page.screenshot({ path: 'test-results/empty-rooms.png', fullPage: true });
  await page.unroute('**/api/v1/rooms'); await page.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(page.locator('.room-item')).toHaveCount(5);
});

test('initial calendar failure recovers and missing room has a way back', async ({ page }) => {
  await registerLogin(page);
  await page.route('**/api/v1/rooms/*/calendar?*', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('link', { name: /บ้านพักหลัก/ }).click();
  await expect(page.getByRole('heading', { name: 'ตรวจวันว่างไม่สำเร็จ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ตรวจสอบการจอง', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/calendar-error.png', fullPage: true });
  await page.unroute('**/api/v1/rooms/*/calendar?*'); await page.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(page.getByLabel('เบอร์โทรศัพท์', { exact: true })).toBeVisible();
  await page.goto('/rooms/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'ไม่พบห้องที่เปิดรับจอง' })).toBeVisible();
  await page.getByRole('link', { name: 'กลับไปเลือกห้องพัก', exact: true }).click(); await expect(page.locator('.room-item')).toHaveCount(5);
});

test('broken photo has fallback and unknown route has a recovery page', async ({ page }) => {
  await page.route('**/images/*.jpg', route => route.abort('failed'));
  await registerLogin(page);
  await expect(page.getByText('ไม่มีภาพตัวอย่าง')).toHaveCount(5);
  await page.getByRole('link', { name: /บ้านพักหลัก/ }).click();
  await expect(page.getByRole('heading', { name: 'เลือกวันเข้าพัก' })).toBeVisible();
  await page.goto('/unknown-page'); await expect(page.getByRole('heading', { name: 'ไม่พบหน้าที่คุณต้องการ' })).toBeVisible();
  await page.getByRole('link', { name: 'กลับไปหน้าห้องพัก' }).click(); await expect(page.locator('.room-item')).toHaveCount(5);
});

test('logout failure stays signed in and allows retry', async ({ page }) => {
  await registerLogin(page);
  await page.route('**/api/v1/auth/logout', route => route.abort('failed'));
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('เชื่อมต่อไม่สำเร็จ'); await expect(page.locator('.room-item')).toHaveCount(5);
  await page.unroute('**/api/v1/auth/logout'); await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
});

test('lost booking response after commit warns without resubmitting and refreshes availability', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  let requests = 0;
  await page.route('**/api/v1/bookings', async route => { requests++; await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
  await expect(page.getByText(/ยังยืนยันผลการจองไม่ได้/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ตรวจสอบการจอง', exact: true })).toBeDisabled();
  expect(requests).toBe(1); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
  await page.getByRole('button', { name: 'ตรวจผลการจอง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
  await expect(page.locator('.calendar-booked')).toHaveCount(2);
  await expect(page.getByLabel('วันเข้า', { exact: true })).toHaveValue('');
  expect(requests).toBe(1);
});

test('auth network and rate-limit errors preserve fields for retry', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('ชื่อ-สกุล', { exact: true }).fill('ผู้ตรวจระบบ'); await page.getByLabel('อีเมล', { exact: true }).fill('retry@example.com'); await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
  await page.route('**/api/v1/auth/register', route => route.abort('failed'));
  await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('เชื่อมต่อไม่สำเร็จ'); await expect(page.getByLabel('อีเมล', { exact: true })).toHaveValue('retry@example.com');
  await page.unroute('**/api/v1/auth/register'); await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('อีเมล', { exact: true }).fill('retry@example.com'); await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
  await page.route('**/api/v1/auth/login', route => route.fulfill({ status: 429, headers: { 'Retry-After': '30' }, json: { error: { code: 'RATE_LIMITED', message: 'Rate limited' } } }));
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('30 วินาที');
  await page.unroute('**/api/v1/auth/login'); await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await expect(page.locator('.room-item')).toHaveCount(5);
});

test('confirmed booking keeps receipt even when calendar refresh fails', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  await page.route('**/api/v1/rooms/*/calendar?*', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ตรวจวันว่างไม่สำเร็จ' })).toBeVisible();
  expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
  await page.unroute('**/api/v1/rooms/*/calendar?*'); await page.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(page.locator('.calendar-booked')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
});

test('fully booked visible months explain how to continue', async ({ page }) => {
  await registerLogin(page); const owner = (await pool.query('SELECT id FROM users')).rows[0].id;
  for (let days = 0; days < 90; days += 30) await pool.query("INSERT INTO bookings(user_id,room_id,check_in,check_out,guest_name,guest_phone,guest_email) VALUES($1,'7c71298a-ef46-457c-ab5e-9edb238a54e5',$2,$3,'Existing Guest','+66812345678','existing@example.com')", [owner, next(today, days), next(today, days + 30)]);
  await openRoom(page);
  await expect(page.getByText('ไม่มีคืนว่างในช่วงที่แสดง ลองเปลี่ยนเดือนหรือเลือกห้องอื่น')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ตรวจสอบการจอง', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'ห้องพักทั้งหมด', exact: true }).click(); await expect(page.locator('.room-item')).toHaveCount(5);
});

test('pending booking disables duplicate action and cannot dismiss the dialog', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let requests = 0;
  await page.route('**/api/v1/bookings', async route => { requests++; await gate; await route.continue(); });
  try {
    await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ยืนยันการจอง', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'ยืนยันการจอง' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ปิดหน้าต่าง' })).toBeDisabled();
  } finally { release(); }
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
  expect(requests).toBe(1); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
});

test('slow room loading shows a placeholder then the actual list', async ({ page }) => {
  await registerLogin(page);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/rooms', async route => { await gate; await route.continue(); });
  try { await page.reload(); await expect(page.getByLabel('กำลังโหลดห้องพัก', { exact: true })).toBeVisible(); await expect(page.locator('.room-item')).toHaveCount(0); } finally { release(); }
  await expect(page.locator('.room-item')).toHaveCount(5);
});

test('failed lazy page shows reload recovery and reload opens the room', async ({ page }) => {
  await registerLogin(page);
  await page.route('**/src/pages/RoomPage.tsx*', route => route.abort('failed'));
  await page.getByRole('link', { name: /บ้านพักหลัก/ }).click();
  await expect(page.getByRole('heading', { name: 'เปิดหน้านี้ไม่สำเร็จ' })).toBeVisible();
  await page.screenshot({ path: 'test-results/reload-recovery.png', fullPage: true });
  await page.unroute('**/src/pages/RoomPage.tsx*');
  await page.getByRole('button', { name: 'โหลดหน้าใหม่', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'เลือกวันเข้าพัก' })).toBeVisible();
});


test('safe replay returns the same booking and the next booking uses a new key', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  const keys: string[] = [];
  await page.route('**/api/v1/bookings', async route => { keys.push(route.request().headers()['idempotency-key']); if (keys.length === 1) { await route.fetch(); await route.abort('failed'); } else await route.continue(); });
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
  await expect(page.getByText(/ยังยืนยันผลการจองไม่ได้/)).toBeVisible();
  await page.getByRole('button', { name: 'ส่งคำขอเดิมอีกครั้ง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
  await page.getByRole('button', { name: 'กลับไปดูปฏิทิน' }).click(); await fillBooking(page, next(today,4), next(today,6)); await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
  expect(keys[2]).not.toBe(keys[0]); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('2');
});

test('a request that never arrived can be checked then retried with the same key', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  let originalKey = '';
  await page.route('**/api/v1/bookings', route => { originalKey = route.request().headers()['idempotency-key']; return route.abort('failed'); });
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click();
  await page.getByRole('button', { name: 'ตรวจผลการจอง', exact: true }).click(); await expect(page.getByText(/ยังไม่พบผลการจอง คำขอเดิมอาจกำลังประมวลผล ตรวจอีกครั้ง/)).toBeVisible();
  expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('0');
  await page.unroute('**/api/v1/bookings'); const post = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/bookings'));
  await page.getByRole('button', { name: 'ส่งคำขอเดิมอีกครั้ง', exact: true }).click(); expect((await post).headers()['idempotency-key']).toBe(originalKey);
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible(); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
});

test('reload recovers a committed request without persisting guest details', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  await page.route('**/api/v1/bookings', async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click(); await expect(page.getByText(/ยังยืนยันผลการจองไม่ได้/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ตรวจผลการจอง', exact: true })).toBeFocused();
  const entries = await page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith('booking-request:'))); expect(entries).toHaveLength(1); expect(entries[0][1]).toMatch(/^[0-9a-f-]{36}$/);
  await page.screenshot({ path: 'test-results/booking-recovery.png', fullPage: true });
  await page.reload(); await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('booking-request:')))).toHaveLength(0);
  expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
});

test('reloaded recovery can retry a failed lookup', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page);
  await page.route('**/api/v1/bookings', async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click(); await expect(page.getByText(/ยังยืนยันผลการจองไม่ได้/)).toBeVisible();
  await page.route('**/api/v1/bookings/requests/*', route => route.fulfill({ status: 503, body: 'Unavailable' })); await page.reload();
  await expect(page.getByText(/ตรวจผลการจองไม่สำเร็จ:/)).toBeVisible();
  await page.unroute('**/api/v1/bookings/requests/*'); await page.getByRole('button', { name: 'ตรวจผลการจองอีกครั้ง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible(); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
});

test('reload of an uncommitted request reuses its key when the guest fills the form again', async ({ page }) => {
  await registerLogin(page); await openRoom(page); await fillBooking(page); let key = '';
  await page.route('**/api/v1/bookings', route => { key = route.request().headers()['idempotency-key']; return route.abort('failed'); });
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click(); await expect(page.getByText(/ยังยืนยันผลการจองไม่ได้/)).toBeVisible();
  await page.unroute('**/api/v1/bookings'); await page.reload(); await expect(page.getByText(/ยังไม่พบผลการจอง คำขอเดิมอาจกำลังประมวลผล ตรวจผลอีกครั้ง/)).toBeVisible();
  await fillBooking(page); const post = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/bookings'));
  await page.getByRole('button', { name: 'ยืนยันการจอง', exact: true }).click(); expect((await post).headers()['idempotency-key']).toBe(key);
  await expect(page.getByRole('heading', { name: 'บันทึกการจองเรียบร้อยแล้ว' })).toBeVisible(); expect((await pool.query('SELECT count(*) FROM bookings')).rows[0].count).toBe('1');
});

