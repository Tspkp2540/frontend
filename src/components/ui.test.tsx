import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary, Button, Modal, RoomImage, TextField } from './ui';
describe('shared components', () => {
  it('shows a recovery page when rendering fails', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never { throw new Error('test render failure'); }
    try { render(<AppErrorBoundary><Broken /></AppErrorBoundary>); expect(screen.getByRole('heading', { name: 'เปิดหน้านี้ไม่สำเร็จ' })).toBeVisible(); expect(screen.getByRole('button', { name: 'โหลดหน้าใหม่' })).toBeEnabled(); expect(screen.getByRole('link', { name: 'กลับไปหน้าห้องพัก' })).toHaveAttribute('href', '/rooms'); } finally { log.mockRestore(); }
  });
  it('shows an accessible placeholder when a photo fails', () => {
    render(<RoomImage src="/missing.jpg" alt="ห้องตัวอย่าง" />); fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img', { name: 'ห้องตัวอย่าง' })).toHaveTextContent('ไม่มีภาพตัวอย่าง');
  });
  it('associates labels and field errors accessibly', () => { render(<TextField label="อีเมล" error="อีเมลไม่ถูกต้อง" />); expect(screen.getByLabelText('อีเมล')).toHaveAttribute('aria-invalid', 'true'); expect(screen.getByLabelText('อีเมล')).toHaveAccessibleDescription('อีเมลไม่ถูกต้อง'); });
  it('disables a busy action', () => { render(<Button busy>บันทึก</Button>); expect(screen.getByRole('button')).toBeDisabled(); expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true'); });
  it('traps focus in the dialog and closes with Escape', async () => {
    function Demo() { const [open, setOpen] = useState(false); return <><Button onClick={() => setOpen(true)}>เปิด</Button><Modal open={open} onClose={() => setOpen(false)} title="ตรวจสอบข้อมูล" description="ตรวจวันเข้าพักก่อนยืนยัน" actions={<Button onClick={() => setOpen(false)}>ยืนยัน</Button>} /></>; }
    const user = userEvent.setup(); render(<Demo />); await user.click(screen.getByText('เปิด'));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('ตรวจสอบข้อมูล');
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getByRole('button',{name:'เปิด'})).toHaveFocus();
  });
});
