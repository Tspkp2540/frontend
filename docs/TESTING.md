# Frontend testing

รันจาก Frontend repository หลัง `npm ci` Unit/build/mutation ไม่ต้องมี Backend checkout

| คำสั่ง | ตรวจอะไร |
|---|---|
| npm run format:check | ตรวจรูปแบบ source/tests แบบเดียวกับ CI |
| npm run test:coverage | Components, Router, QueryClient และ failure paths พร้อม coverage gates |
| npm run build | TypeScript และ production bundle |
| npm run test:mutation | แก้ source copy ทีละจุดเพื่อตรวจว่าชุดทดสอบจับความผิดได้ |
| npm run test:classifier | ตัวแยกผล mutation |
| npm run test:ci-guards | ปฏิเสธ focused tests ใน CI |
| npm run test:system | Browser กับ API/PostgreSQL จริง |

## ผลล่าสุดในเครื่อง

13 พฤศจิกายน 2026: browser 35/35 flows ผ่านใน 1.4 นาที ไม่มี failed/skipped/flaky; ตรวจเบอร์โทร 10 หลัก, error/success popup และการคืนโฟกัสหลังปิด popup

Unit/component 109 tests ผ่าน: statements 97.72%, branches 95.51%, functions 98.81%, lines 98.73% ผ่าน coverage gates เดิม พร้อม TypeScript และ production build

Mutation catalogue ตรวจซ้ำหลังปรับเบอร์โทรและ popup: killed 14/14; survived/invalid/timeout เป็น 0

Focused-test guardใช้outputDirแยกใน.ci-work จึงไม่ลบtraceของbrowser suiteที่รันพร้อมกัน ตรวจisolationและbrowser35flowsผ่านแล้ว

รูปแบบโค้ด: `npm run format` จัดรูปแบบ และ `npm run format:check` ตรวจแบบเดียวกับCI ใช้ .prettierrc.json และ LFตาม.gitattributes ทั้งWindows/Linux

Coverage gates: statements/lines/functions ≥90%, branches ≥85%; dates/AuthProvider/BookingRecovery branches100% ไม่รวม main.tsx ซึ่งตรวจ entry/lazy wiring ผ่าน browser

เพิ่มการตรวจ popup จอง/ยกเลิกสำเร็จ ปิดแล้วดูใบยืนยันและประวัติต่อได้ ไม่เปิดซ้ำเมื่อกู้รายการเดิมหลัง reload; กรณีจองสำเร็จพร้อม calendar error ตรวจ popup แต่ละสถานะแยกกัน

เพิ่มเคสเบอร์ไทยถูก/ผิดรูปแบบ, แปลงเบอร์ก่อนส่ง API, popup title/description/ตกลง, คิวและการรวม error ซ้ำ, ไม่เปิด popup สำหรับ signed-out/pending/cancelled request และไม่แสดง diagnostics จาก 5xx

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

หลักฐาน GitHub ที่ยืนยันแล้ว วันที่10พฤศจิกายน2026:

| การตรวจ | Commit ที่ใช้ | ผล |
|---|---|---|
| Frontend quality | 85162adb597a15b9c2905d5a9903aa8fcf0db44e | [ผ่าน](https://github.com/Tspkp2540/frontend/actions/runs/42704414399) |
| Backend quality | d7fe382e488f1ca0ada7d2ccd2073f7b06c195f8 | [ผ่าน](https://github.com/Tspkp2540/hotel_be/actions/runs/42670436874) |
| Browser integration | คู่ commit ข้างบน | [35 flows ผ่าน](https://github.com/Tspkp2540/frontend/actions/runs/42704667964) |

Quality CIรันเมื่อpush/PR และตรวจ format ด้วย ส่วน browser integrationสั่งผ่านworkflow_dispatchพร้อม Backend SHA ผลแต่ละ run รับรองเฉพาะ commit ที่ระบุ การแก้ไขภายหลังต้องตรวจใหม่ ยังไม่มี deploymentจริงหรือload/penetration test
