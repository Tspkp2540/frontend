import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { api, ApiError, errorMessage } from '../lib/api';
import { registerSchema } from '../lib/validation';
import { Alert, Button, RoomImage, TextField } from '../components/ui';

type Values = { email: string; password: string; fullName?: string };
export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [visible, setVisible] = useState(false); const [error, setError] = useState('');
  const schema = registerSchema.partial({ fullName: true }).superRefine((values, context) => {
    if (register && !values.fullName) context.addIssue({ code: 'custom', path: ['fullName'], message: 'กรุณากรอกชื่อ-สกุล' });
  });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', ...(register ? { fullName: '' } : {}) } });
  if (auth.session) return <Navigate to="/rooms" replace />;
  async function submit(values: Values) {
    setError('');
    try {
      if (register) {
        await api.register({ ...values, fullName: values.fullName ?? '' });
        navigate('/login', { replace: true, state: { registered: true } });
      } else {
        const session = await api.login(values); auth.setSession(session);
        const from = location.state?.from;
        navigate(typeof from === 'string' && /^\/rooms(?:\/|$)/.test(from) ? from : '/rooms', { replace: true });
      }
    } catch (error) {
      if (error instanceof ApiError && error.fields.length) {
        for (const field of error.fields) if (['email', 'password', 'fullName'].includes(field.field)) form.setError(field.field as keyof Values, { message: field.message });
      }
      setError(errorMessage(error));
    }
  }
  return <div className="auth-layout" key={register ? 'register' : 'login'}>
    <aside className="auth-photo"><RoomImage src="/images/main.jpg" alt="ภาพประกอบบ้านพักท่ามกลางธรรมชาติ" /><div className="photo-caption"><span>YOUR TIME, YOUR SPACE</span><p>พื้นที่สำหรับ<br />วันพักของคุณ</p><small>ภาพประกอบที่พักตัวอย่าง</small></div></aside>
    <section className="auth-panel"><div className="auth-form-wrap">
      <p className="eyebrow">WELCOME TO BAAN PAK</p>
      <h1>{register ? 'เริ่มต้นวันพักของคุณ' : 'ยินดีต้อนรับกลับ'}</h1>
      <p className="intro">{register ? 'สมัครสมาชิกเพื่อเลือกห้องและจองวันเข้าพัก' : 'เข้าสู่ระบบเพื่อดูวันว่างและจองที่พัก'}</p>
      {location.state?.registered && !register && <Alert tone="info">สมัครสมาชิกเรียบร้อยแล้ว เข้าสู่ระบบด้วยบัญชีของคุณได้เลย</Alert>}
      <form onSubmit={form.handleSubmit(submit)} noValidate className="stack-form">
        {register && <TextField label="ชื่อ-สกุล" autoComplete="name" placeholder="ชื่อของคุณ" {...form.register('fullName')} error={form.formState.errors.fullName?.message} />}
        <TextField label="อีเมล" type="email" autoComplete="email" inputMode="email" placeholder="example@email.com" {...form.register('email')} error={form.formState.errors.email?.message} />
        <TextField label="รหัสผ่าน" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} {...form.register('password')} hint={register ? 'ใช้ 12–128 ตัวอักษร' : undefined} error={form.formState.errors.password?.message} trailing={<button type="button" className="input-action" aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" busy={form.formState.isSubmitting}>{register ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}<ArrowRight size={18} /></Button>
      </form>
      <p className="auth-switch">{register ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'} <Link to={register ? '/login' : '/register'}>{register ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</Link></p>
      <div className="auth-note"><span className="tiny-rule" />เลือกห้อง เลือกวัน แล้วออกไปพักผ่อน</div>
    </div></section>
  </div>;
}

