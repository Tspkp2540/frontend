import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../lib/api';
import { setup, teardown, mount, room, session, deferred, offline, unauthorized } from '../../test/support';
import { useAuth } from '../auth/AuthProvider';
import type { Session } from '../lib/types';
beforeEach(setup); afterEach(teardown);
const click = async(name:string) => userEvent.click(screen.getByRole('button',{name}));
async function fillAuth() { fireEvent.change(screen.getByLabelText('อีเมล',{exact:true}),{target:{value:'test@example.com'}}); fireEvent.change(screen.getByLabelText('รหัสผ่าน',{exact:true}),{target:{value:'secure-password-123'}}); }

describe('authentication and protected navigation',()=>{
  it('requires an auth provider instead of silently granting access',()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    expect(()=>renderHook(()=>useAuth())).toThrow('AuthProvider is required');log.mockRestore();
  });
  it('waits for session lookup and redirects anonymous visitors without loading rooms',async()=>{
    const pending=deferred<Session>(); vi.mocked(api.me).mockReturnValue(pending.promise); mount();
    expect(screen.getByText('กำลังตรวจสอบการเข้าสู่ระบบ…')).toBeVisible(); expect(api.rooms).not.toHaveBeenCalled();
    await act(async()=>pending.reject(unauthorized())); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'}); expect(api.rooms).not.toHaveBeenCalled();
  });
  it('recovers from session lookup failure',async()=>{
    vi.mocked(api.me).mockRejectedValueOnce(offline()); mount(); await screen.findByRole('heading',{name:'ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ'}); await click('ลองใหม่'); await screen.findByRole('heading',{name:/เลือกห้องพัก\s*\./});
  });
  it('logs in and returns to the originally requested room',async()=>{
    vi.mocked(api.me).mockRejectedValue(unauthorized()); mount(`/rooms/${room.id}`); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'}); await fillAuth(); await click('เข้าสู่ระบบ'); await screen.findByRole('heading',{name:'เลือกวันเข้าพัก'});
    expect(api.login).toHaveBeenCalledWith({email:'test@example.com',password:'secure-password-123'});
  });
  it('returns to my bookings after signing in',async()=>{
    vi.mocked(api.me).mockRejectedValue(unauthorized()); mount('/my-bookings'); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'}); await fillAuth(); await click('เข้าสู่ระบบ'); await screen.findByRole('heading',{name:/การจองของฉัน/});
  });
  it('preserves search filters through login',async()=>{
    vi.mocked(api.me).mockRejectedValue(unauthorized()); mount('/login',{from:'/rooms?q=บ้านพัก&province=เชียงใหม่'}); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'}); await fillAuth(); await click('เข้าสู่ระบบ'); await screen.findByRole('heading',{name:/เลือกห้องพัก/});
    expect(screen.getByLabelText('ค้นหาที่พัก')).toHaveValue('บ้านพัก'); expect(screen.getByLabelText('จังหวัด')).toHaveValue('เชียงใหม่');
  });
  it('rejects an unsafe redirect after login',async()=>{
    vi.mocked(api.me).mockRejectedValue(unauthorized()); mount('/login',{from:'https://other.example'}); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'}); await fillAuth(); await click('เข้าสู่ระบบ'); await screen.findByRole('heading',{name:/เลือกห้องพัก\s*\./});
  });
  it('redirects an already signed-in user away from login',async()=>{mount('/login'); await screen.findByRole('heading',{name:/เลือกห้องพัก\s*\./});});
  it('shows field errors from login and lets users retry without losing input',async()=>{
    vi.mocked(api.me).mockRejectedValue(unauthorized()); vi.mocked(api.login).mockRejectedValueOnce(new ApiError(422,'VALIDATION_ERROR','ข้อมูลผิด',[{field:'email',code:'INVALID_FORMAT',message:'ตรวจอีเมลอีกครั้ง'},{field:'ignored',code:'OTHER',message:'ignored'}]));
    mount('/login'); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'}); await fillAuth(); await click('แสดงรหัสผ่าน'); expect(screen.getByLabelText('รหัสผ่าน',{exact:true})).toHaveAttribute('type','text'); await click('ซ่อนรหัสผ่าน'); await click('เข้าสู่ระบบ');
    await screen.findByText('ตรวจอีเมลอีกครั้ง'); expect(screen.getByLabelText('อีเมล',{exact:true})).toHaveValue('test@example.com'); await click('เข้าสู่ระบบ'); await screen.findByRole('heading',{name:/เลือกห้องพัก\s*\./});
  });
  it('validates required registration name and registers before returning to login',async()=>{
    vi.mocked(api.me).mockRejectedValue(unauthorized()); mount('/register'); await screen.findByRole('heading',{name:'เริ่มต้นวันพักของคุณ'}); await fillAuth(); await click('สมัครสมาชิก'); await screen.findByText('กรุณากรอกชื่อ 1–150 ตัวอักษร'); expect(api.register).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('ชื่อ-สกุล'),{target:{value:'ผู้ทดสอบ'}}); await click('สมัครสมาชิก'); await screen.findByText('สมัครสมาชิกเรียบร้อยแล้ว เข้าสู่ระบบด้วยบัญชีของคุณได้เลย');
  });
  it('preserves the signed-in page on logout failure and retries successfully',async()=>{
    vi.mocked(api.logout).mockRejectedValueOnce(offline()); mount(); await screen.findByRole('heading',{name:/เลือกห้องพัก\s*\./}); await click('ออกจากระบบ'); await screen.findByText('เชื่อมต่อไม่สำเร็จ'); expect(screen.getByRole('heading',{name:/เลือกห้องพัก\s*\./})).toBeVisible(); await click('ออกจากระบบ'); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'});
  });
  it.each(['button','escape'])('clears private cached data on session expiry and exits via %s',async(method)=>{
    const {client}=mount(); await screen.findByRole('heading',{name:/เลือกห้องพัก\s*\./}); client.setQueryData(['booking-request','private'],{guestEmail:'private@example.com'});
    act(()=>window.dispatchEvent(new Event('session-expired'))); await screen.findByRole('dialog',{name:'กรุณาเข้าสู่ระบบอีกครั้ง'}); expect(client.getQueryData(['booking-request','private'])).toBeUndefined();
    if(method==='escape')await userEvent.keyboard('{Escape}');else await click('เข้าสู่ระบบ'); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'});
  });
  it('ignores expiry events when already anonymous',async()=>{
    vi.mocked(api.me).mockRejectedValue(unauthorized()); mount('/login'); await screen.findByRole('heading',{name:'ยินดีต้อนรับกลับ'}); act(()=>window.dispatchEvent(new Event('session-expired'))); expect(screen.queryByRole('dialog')).toBeNull();
  });
});
describe('room page loading and recovery',()=>{
  it('shows loading placeholders until room data arrives',async()=>{
    const pending=deferred<{rooms:typeof room[]}>(); vi.mocked(api.rooms).mockReturnValue(pending.promise); mount(); await screen.findByLabelText('กำลังโหลดห้องพัก'); await act(async()=>pending.resolve({rooms:[room]})); await screen.findByRole('link',{name:/บ้านพักหลัก/});
  });
  it('refreshes an empty room list',async()=>{vi.mocked(api.rooms).mockResolvedValueOnce({rooms:[]});mount();await screen.findByRole('heading',{name:'ยังไม่มีห้องที่เปิดรับจอง'});await click('ลองใหม่');await screen.findByRole('link',{name:/บ้านพักหลัก/});});
  it('retries a room list error',async()=>{vi.mocked(api.rooms).mockRejectedValueOnce(offline());mount();await screen.findByRole('heading',{name:'โหลดห้องพักไม่สำเร็จ'});await click('ลองใหม่');await screen.findByRole('link',{name:/บ้านพักหลัก/});});
  it('retries room loading on a detail route',async()=>{vi.mocked(api.rooms).mockRejectedValueOnce(offline());mount(`/rooms/${room.id}`);await screen.findByRole('heading',{name:'โหลดห้องพักไม่สำเร็จ'});await click('ลองใหม่');await screen.findByRole('heading',{name:'เลือกวันเข้าพัก'});});
  it('offers recovery for an unknown room',async()=>{mount('/rooms/missing');await screen.findByRole('heading',{name:'ไม่พบห้องที่เปิดรับจอง'});await click('ลองใหม่');await userEvent.click(screen.getByRole('link',{name:'กลับไปเลือกห้องพัก'}));await screen.findByRole('heading',{name:/เลือกห้องพัก\s*\./});});
});



