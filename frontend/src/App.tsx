import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { login } from './api';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';

function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const { login: setAuth } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await login(username, password);
      setAuth(res.access_token, res.name, res.role);
    } catch { setErr('Invalid credentials - try admin/admin or employee/employee'); }
  };

  return (
    <div className="flex bg-[#020617] min-h-screen items-center justify-center font-sans">
      <form onSubmit={handleLogin} className="p-10 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-8 w-96 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl rounded-tr-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl rounded-bl-3xl"></div>
        
        <div className="relative z-10 space-y-2">
            <h2 className="text-4xl font-black tracking-tight text-white text-center flex items-center justify-center gap-3">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            ShizenAI
            </h2>
            <p className="text-center text-slate-400 font-mono text-xs tracking-widest uppercase">Capture knowledge. Verify fluency. Build trust.</p>
        </div>

        <div className="space-y-4 relative z-10">
            {err && <p className="text-red-400 text-sm text-center font-mono">{err}</p>}
            <input className="w-full bg-black/50 text-white px-4 py-3.5 rounded-xl border border-slate-700/50 focus:border-emerald-500/50 outline-none transition-colors" placeholder="Username (admin or employee)" value={username} onChange={e=>setUsername(e.target.value)}/>
            <input type="password" className="w-full bg-black/50 text-white px-4 py-3.5 rounded-xl border border-slate-700/50 focus:border-emerald-500/50 outline-none transition-colors" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
        </div>
        <button className="relative z-10 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider py-4 text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">Sign In Securely</button>
      </form>
    </div>
  );
}

function MainLayout() {
  const { user, logout } = useAuth();
  
  if (!user) return <LoginScreen />;
  
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-white/5 bg-white/5 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">ShizenAI <span className="text-emerald-500 font-light">| Knowledge Capture & Fluency Tracking</span></h1>
          </div>
          
          <div className="flex items-center gap-8 text-sm">
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/30 border border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>
              <span className="font-mono text-gray-300 flex items-center gap-2">
                 <span className="text-emerald-400 capitalize">{user.role}</span> &mdash; {user.name}
              </span>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-white font-semibold transition-colors uppercase tracking-wider text-xs">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {user.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
