# Frontend testing

รันจาก repository root หลัง npm ci โดยไม่ต้องมี Backend source

| คำสั่ง | งาน / ผลล่าสุด |
|---|---|
| npm run test:coverage | 75 unit/component tests ผ่าน |
| npm run build | TypeScript และ production bundle |
| npm run test:mutation | 13/13 targeted mutants จับได้ |
| npm run test:classifier | 10 tests ของตัวแยกผล mutation |
| npm run test:ci-guards | ปฏิเสธ focused tests ของ Vitest/Playwright เมื่อ CI=true |

Coverage: Lines 100%, Statements 97.55%, Functions 98.37%, Branches 95.12% Gate รวม ≥90/90/90/85 และ branches ของ dates/AuthProvider/BookingRecovery ต้อง 100% ไม่รวม main.tsx entry/lazy wiring ที่ตรวจผ่าน browser suite

Tests ใช้ components, Router และ QueryClient จริง ควบคุม API responses เพื่อทดสอบ success/error/races ส่วน browser integration ใช้ API/PostgreSQL จริง

Mutation เป็น catalog ที่กำหนด ไม่ใช่ exhaustive scan รัน baseline ก่อนและแก้ source copy แยก ไม่มีการแก้ production source ดู [catalog](../scripts/mutation-catalog.mjs) ผลอยู่ที่ mutation-report/summary.json การใช้ --id เก็บรายงานแยก ไม่ถือ compile/import error หรือ timeout เป็น killed

```sh
npm run test:mutation -- --list
npm run test:mutation -- --id=FE-DATE-03
```

## Browser integration

27 flows ตรวจ auth, 5 ห้อง, booking, conflict, expiry, recovery, reload, empty/error/retry, mobile overflow และ modal focus

1. Clone Backend ไว้ตำแหน่งใดก็ได้ รัน npm ci และ npm run build ใน checkout นั้น
2. ติดตั้ง browser: Windows ใช้ Edge; Linux ใช้ npx playwright install --with-deps chromium
3. ตั้ง BACKEND_DIR เป็น path ของ checkout ที่เลือก แล้วรัน npm run test:system

Runner ใช้ migrations/seed จาก Backend ที่เลือก สร้างฐานข้อมูลชั่วคราวและลบเมื่อจบ หากมี API/DB ทดสอบเตรียมไว้แล้ว ใช้ BASE_URL และ TEST_DATABASE_URL กับ npm run test:e2e แทน ไม่ต้องมี Backend checkout

**ห้ามชี้ TEST_DATABASE_URL ไป production** เพราะ tests ล้าง fixtures

## GitHub Actions

- [CI หลัก](../.github/workflows/ci.yml) ทำงานบน PR/push main/master; build/coverage/mutation ไม่มี Backend dependency ใช้ required check CI required
- [Integration](../.github/workflows/integration.yml) สั่ง workflow_dispatch โดยกรอก Backend repository แบบ owner/repo และ commit SHA 40 ตัว ใช้ revision แน่นอนเพื่อทำซ้ำได้
- Public Backend ใช้ token ปกติได้ หาก Backend เป็น private ให้เจ้าของตั้ง secret BACKEND_READ_TOKEN ที่อ่าน repository เป้าหมายได้ก่อน ไม่ต้องใช้ secret นี้กับ CI หลักของ PR

## ผลที่ตรวจบน GitHub — 9 พฤศจิกายน 2026

| การตรวจ | ผล |
|---|---|
| [Frontend quality](https://github.com/Tspkp2540/frontend/actions/runs/42524975877) | ผ่าน รวม CI required |
| [Backend quality](https://github.com/Tspkp2540/hotel_be/actions/runs/42524914709) | ผ่าน รวม CI required |
| [Paired integration](https://github.com/Tspkp2540/frontend/actions/runs/42525412974) | 27 browser flows ผ่าน |

Backend: [Tspkp2540/hotel_be](https://github.com/Tspkp2540/hotel_be), commit [0e56e76](https://github.com/Tspkp2540/hotel_be/commit/0e56e76e1c553f9f132fb74e2a2047a840b21d07)
Frontend commit ที่ใช้: [d5eabbd](https://github.com/Tspkp2540/frontend/commit/d5eabbd719951b9340deecddff01c93187be4b01)

Required check CI required บน main ตั้งแล้วทั้งสอง repository หลักฐาน integration ใช้คู่ commits ที่ระบุ ไม่ใช่การทดสอบ Backend revision ใหม่โดยอัตโนมัติ

[UI states](STATES.md) · [ภาพประกอบ](../ASSETS.md)
