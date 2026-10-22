import { useEffect, useState } from 'react';
import { Layers3, Moon, Sun } from 'lucide-react';
import { api, json, setCsrf } from './api.js';
import { ErrorMessage } from './ui.jsx';

export function useTheme(theme) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme || 'light'; };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
export function AuthScreen({ onSignedIn, initialError = '' }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', password:'' });
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const result = await api(register ? '/auth/register' : '/auth/login', json('POST', form)); setCsrf(result.csrf); onSignedIn(result.user); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="auth-intro"><div className="brand"><div className="brand-symbol"><Layers3 /></div><strong>taskflow.</strong></div><div className="eyebrow">A LITTLE PROGRESS, EVERY DAY</div><h1>Good work starts<br />with a clear plan.</h1><p>Bring your projects, people and priorities together. Make room for what matters.</p><div className="auth-feature">✓ Personal and shared project spaces</div><div className="auth-feature">✓ Boards, calendars and clear deadlines</div><div className="auth-feature">✓ A team that stays in sync</div></section><section className="auth-card"><h2>{register ? 'Create your account' : 'Welcome back'}</h2><p>{register ? 'Your workspace starts here.' : 'Sign in to continue to your workspace.'}</p><form onSubmit={submit}><fieldset disabled={busy}>{register && <label>Your name<input required autoComplete="name" maxLength={80} value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} /></label>}<label>Email<input required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e => setForm({ ...form, email:e.target.value })} /></label><label>Password<input required type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} maxLength={128} value={form.password} onChange={e => setForm({ ...form, password:e.target.value })} /></label>{register && <small>Use at least 12 characters.</small>}</fieldset><ErrorMessage message={error} /><button className="btn primary auth-submit" disabled={busy}>{busy ? 'Please wait...' : register ? 'Create account' : 'Sign in'}</button></form><button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setForm({ ...form, password:'' }); }}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></section></main>;
}
export function AccountSettings({ user, onUser, notify }) {
  const [profile, setProfile] = useState({ name:user.name, bio:user.bio, theme:user.theme, notifications_enabled:user.notifications_enabled });
  const [password, setPassword] = useState({ current_password:'', new_password:'' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api('/auth/profile', json('PATCH', profile)); onUser(result); notify('Profile and settings saved.'); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function changePassword(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api('/auth/password', json('POST', password)); setCsrf(result.csrf); setPassword({ current_password:'', new_password:'' }); notify(result.message); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div className="settings-grid"><section className="panel"><h2>Profile & preferences</h2><form className="standard-form" onSubmit={save}><fieldset disabled={busy}><label>Name<input required maxLength={80} value={profile.name} onChange={e => setProfile({ ...profile,name:e.target.value })} /></label><label>Email<input value={user.email} readOnly /></label><label>About you<textarea rows={3} maxLength={500} value={profile.bio} onChange={e => setProfile({ ...profile,bio:e.target.value })} /></label><label>Appearance<select value={profile.theme} onChange={e => setProfile({ ...profile,theme:e.target.value })}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="checkbox-label"><input type="checkbox" checked={profile.notifications_enabled} onChange={e => setProfile({ ...profile,notifications_enabled:e.target.checked })} />In-app deadline and activity notifications</label></fieldset><button className="btn primary" disabled={busy}>Save settings</button></form></section><section className="panel"><h2>Change password</h2><p>Changing your password signs out your other sessions.</p><form className="standard-form" onSubmit={changePassword}><fieldset disabled={busy}><label>Current password<input type="password" required autoComplete="current-password" value={password.current_password} onChange={e => setPassword({ ...password,current_password:e.target.value })} /></label><label>New password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password.new_password} onChange={e => setPassword({ ...password,new_password:e.target.value })} /></label></fieldset><button className="btn secondary" disabled={busy}>Update password</button></form></section><ErrorMessage message={error} /></div>;
}
