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

10 พฤศจิกายน 2026: browser 35/35 flows ผ่านใน1.4นาที ไม่มี failed/skipped/flaky; TypeScript, focused-test guards และactionlintผ่าน

รอบนี้เปลี่ยนเฉพาะ browser tests/report ผลproduction codeจากรอบก่อนยังเป็น unit94 tests, statements97.76%, branches95.51%, functions98.70%, lines100% และ mutation14/14 killed

Coverage gates: statements/lines/functions ≥90%, branches ≥85%; dates/AuthProvider/BookingRecovery branches100% ไม่รวม main.tsx ซึ่งตรวจ entry/lazy wiring ผ่าน browser

ขอบเขตครอบคลุม auth, ค้นหา/จังหวัด, วันเข้า–ออก, conflict, ประวัติ/ยกเลิก, private cache, loading/empty/error/retry, timeout, malformed response และกู้ผลหลัง reload

## Browser integration

1. Build Backend checkout ที่ต้องการ แล้วตั้ง BACKEND_DIR เป็น absolute path
2. Windows ใช้ Edge; Linux ติดตั้ง `npx playwright install --with-deps chromium`
3. รัน `npm run test:system` ซึ่งสร้าง PostgreSQL แยกและลบเมื่อจบ

หากเปิด local3000อยู่ ตั้ง PREVIEW_PORT=3005 ก่อนรันเพื่อไม่ชนกับหน้าที่ใช้ทดสอบมือ

หากเตรียม stack เอง ใช้ BASE_URL และ TEST_DATABASE_URL กับ `npm run test:e2e` ห้ามชี้ DB ใช้งานจริง เพราะ tests ล้าง fixtures

## รายงาน browser

- `playwright-report/index.html`: ผลรายเคส เปิดด้วย `npx playwright show-report`
- `test-results/results.json`: ผลแบบ machine-readable
- เคสล้มเหลวมี screenshot และ trace; เปิด trace ด้วย `npx playwright show-trace <path-to-trace.zip>`
- Workflow integration เก็บทั้งสองโฟลเดอร์เป็น artifact `browser-results` นาน7วัน ไม่มีการเปิดหน้าต่างรายงานอัตโนมัติ

เคสerrorที่เพิ่ม: booking422แก้ไขแล้วส่งใหม่ได้, cancellation409คงconfirmed, โหลดประวัติหน้าถัดไปล้มเหลวแล้วretrycursorเดิม, และเปลี่ยนเดือนเร็วยกเลิกrequestเก่าแต่เดือนล่าสุดสำเร็จ เคส422/เน็ตล้มเหลวควบคุมด้วยroute interception; cutoff409ใช้Backend/DBจริง ทุกเคสตรวจผลUIและDBตามผลกระทบ

## Mutation และรายงาน

Catalogue มี14เคสสำคัญ ไม่ใช่ exhaustive mutation coverage Runner รัน baseline ก่อน ใช้ source copy ใน .mutation-work และตรวจว่าต้นฉบับไม่เปลี่ยน Compile/import error, timeout, skip ไม่นับว่า killed

`npm run test:mutation -- --list` ดูรายการ; `-- --id=FE-DATE-03` เลือกรายเคส ผลอยู่ใน mutation-report/summary.json และ coverage/index.html

## CI

[Quality](../.github/workflows/ci.yml) ตรวจ build/coverage/mutation แยกได้ ใช้ required check CI required ส่วน [Integration](../.github/workflows/integration.yml) รับ Backend repository และ commit SHA40ตัว

[Integration31 flowsบนGitHubผ่าน](https://github.com/Tspkp2540/frontend/actions/runs/42670661922) ใช้ Backendd7fe382 / Frontend934c93a ส่วนautomationที่เพิ่มรอบนี้ยังไม่ได้commit/push Quality CIรันเมื่อpush/PR; browser integrationสั่งผ่านworkflow_dispatchโดยระบุคู่commit ไม่รันอัตโนมัติทุกpush ยังไม่มี deploymentจริงหรือload/penetration test
