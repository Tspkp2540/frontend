# Booking Frontend

React + TypeScript + Vite หน้าเว็บสมัคร/login เลือก 5 ห้อง ดูวันว่างและจองผ่าน session cookie

## ติดตั้งและรัน

ต้องมี Node.js ≥22.18.0 และ npm จาก repository root:

```sh
npm ci
npm run dev
```

เปิด http://127.0.0.1:3000 Vite ส่ง /api ไป http://127.0.0.1:3001 เปลี่ยนด้วย API_PROXY_TARGET ตั้ง FRONTEND_ORIGIN ของ Backend ให้ตรง origin หน้าเว็บ ไม่จำเป็นต้องมี Backend source เพื่อ build หรือรัน unit tests

Production ใช้ `npm run build` ตั้ง VITE_API_BASE_URL ตาม .env.example ผ่าน HTTPS และ static hosting ที่รองรับ SPA fallback

## ตรวจ Frontend

```sh
npm run test:coverage
npm run build
npm run test:mutation
```

รายงานอยู่ใน coverage/ และ mutation-report/ ไม่เข้า source control ดู [Testing](docs/TESTING.md) และ [UI states](docs/STATES.md)

## เปิดทั้งระบบด้วย Backend checkout ที่เลือก

สำหรับ preview/integration เท่านั้น ต้องมี Docker Linux engine และ Backend checkout ที่รัน npm ci และ npm run build แล้ว ระบุ path ให้ชัด ไม่สมมติว่าอยู่โฟลเดอร์ข้างกัน:

```powershell
$env:BACKEND_DIR = 'C:\path\to\booking-backend'
npm run dev:system
```

Bash ใช้ `BACKEND_DIR=/path/to/booking-backend npm run dev:system` เปิด http://127.0.0.1:3000 แล้วสมัครบัญชี Ctrl+C ปิดระบบและลบฐานข้อมูลชั่วคราว ใช้ PREVIEW_PORT เปลี่ยน port ได้

ทดสอบจริงด้วย `npm run test:system` ภายใต้ BACKEND_DIR เดียวกัน Windows ใช้ Edge; Linux ติดตั้ง Chromium ก่อนด้วย `npx playwright install --with-deps chromium`

หากมี stack ทดสอบอยู่แล้ว ใช้ `npm run test:e2e` พร้อม BASE_URL และ TEST_DATABASE_URL ของฐานข้อมูลทดสอบแยกเท่านั้น Tests ล้าง fixtures จึงห้ามชี้ production DB

## CI

[CI หลัก](.github/workflows/ci.yml) ตรวจ build, coverage และ mutations ได้โดยไม่มี Backend ส่วน [Integration workflow](.github/workflows/integration.yml) สั่งเองโดยระบุ Backend repository และ commit SHA ที่แน่นอน ดู [Testing](docs/TESTING.md)

## โครงสร้าง

src/auth/ session · src/components/ shared UI/calendar/form/recovery · src/lib/ API/types/rules · src/pages/ pages · e2e/ browser tests · scripts/ local runners

ไม่เก็บ session token หรือ guest fields ใน browser storage; เก็บเฉพาะ request key เพื่อกู้ผลหลัง reload ภาพใช้ประกอบการสาธิต ดู [ที่มาภาพ](ASSETS.md)
