# Frontend testing

รันจาก Frontend repository หลัง `npm ci` Unit/build/mutation ไม่ต้องมี Backend checkout

| คำสั่ง | ตรวจอะไร |
|---|---|
| npm run test:coverage | Components, Router, QueryClient และ failure paths พร้อม coverage gates |
| npm run build | TypeScript และ production bundle |
| npm run test:mutation | แก้ source copy ทีละจุดเพื่อตรวจว่าชุดทดสอบจับความผิดได้ |
| npm run test:classifier | ตัวแยกผล mutation |
| npm run test:ci-guards | ปฏิเสธ focused tests ใน CI |
| npm run test:system | Browser กับ API/PostgreSQL จริง |

## ผลล่าสุดในเครื่อง

10 พฤศจิกายน 2026: 94 unit/component tests และ 31 browser flows ผ่าน (1.1 นาที), statements 97.76%, branches 95.51%, functions 98.70%, lines 100%; TypeScript/build ผ่าน และ mutation catalogue 14/14 killed ไม่มี survived/invalid/timeout

Coverage gates: statements/lines/functions ≥90%, branches ≥85%; dates/AuthProvider/BookingRecovery branches100% ไม่รวม main.tsx ซึ่งตรวจ entry/lazy wiring ผ่าน browser

ขอบเขตครอบคลุม auth, ค้นหา/จังหวัด, วันเข้า–ออก, conflict, ประวัติ/ยกเลิก, private cache, loading/empty/error/retry, timeout, malformed response และกู้ผลหลัง reload

## Browser integration

1. Build Backend checkout ที่ต้องการ แล้วตั้ง BACKEND_DIR เป็น absolute path
2. Windows ใช้ Edge; Linux ติดตั้ง `npx playwright install --with-deps chromium`
3. รัน `npm run test:system` ซึ่งสร้าง PostgreSQL แยกและลบเมื่อจบ

หากเตรียม stack เอง ใช้ BASE_URL และ TEST_DATABASE_URL กับ `npm run test:e2e` ห้ามชี้ DB ใช้งานจริง เพราะ tests ล้าง fixtures

## Mutation และรายงาน

Catalogue มี14เคสสำคัญ ไม่ใช่ exhaustive mutation coverage Runner รัน baseline ก่อน ใช้ source copy ใน .mutation-work และตรวจว่าต้นฉบับไม่เปลี่ยน Compile/import error, timeout, skip ไม่นับว่า killed

`npm run test:mutation -- --list` ดูรายการ; `-- --id=FE-DATE-03` เลือกรายเคส ผลอยู่ใน mutation-report/summary.json และ coverage/index.html

## CI

[Quality](../.github/workflows/ci.yml) ตรวจ build/coverage/mutation แยกได้ ใช้ required check CI required ส่วน [Integration](../.github/workflows/integration.yml) รับ Backend repository และ commit SHA40ตัว

[หลักฐาน integration เดิม27 flows](https://github.com/Tspkp2540/frontend/actions/runs/42525412974) ใช้ Backend0e56e76 และ Frontendd5eabbd ฟีเจอร์ล่าสุดยังไม่ได้commit/push ผลบน GitHub เดิมไม่ครอบคลุม working tree นี้ ยังไม่มี deployment จริงหรือ load/penetration test
