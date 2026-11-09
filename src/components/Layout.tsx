import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ArrowUpRight, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Alert } from './ui';
import { errorMessage } from '../lib/api';

export function Layout() {
  const { session, logout } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const location = useLocation();
  const authPage = ['/login', '/register'].includes(location.pathname);
  async function signOut() { setBusy(true); setError(''); try { await logout(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); } }
  return <div className="app-shell">
    <a href="#main" className="skip-link">ข้ามไปเนื้อหา</a>
    <header className="site-header"><div className="header-inner">
      <Link to={session ? '/rooms' : '/login'} className="wordmark">บ้านพัก<span className="brand-dot">.</span></Link>
      {session ? <><nav aria-label="เมนูหลัก"><NavLink to="/rooms" className={({isActive}) => isActive ? "nav-active" : ""}>ห้องพักและวันว่าง</NavLink><NavLink to="/my-bookings" className={({isActive}) => isActive ? "nav-active" : ""}>การจองของฉัน</NavLink></nav><div className="account"><span>{session.user.fullName}</span><Button variant="text" onClick={() => void signOut()} busy={busy} aria-label="ออกจากระบบ"><LogOut size={16} /><span>ออกจากระบบ</span></Button></div></> : <Link className="header-link" to={authPage && location.pathname === '/register' ? '/login' : '/register'}>{location.pathname === '/register' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}<ArrowUpRight size={16} /></Link>}
    </div></header>
    {error && <div className="content-wrap"><Alert>{error}</Alert></div>}
    <main id="main"><Outlet /></main>
    <footer className="site-footer"><span>บ้านพัก — ช่วงเวลาดี ๆ เริ่มที่นี่</span><span>© {new Date().getFullYear()} บ้านพัก</span></footer>
  </div>;
}
