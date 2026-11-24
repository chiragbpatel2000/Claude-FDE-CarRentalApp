import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const from = state?.from || '/';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form);
      else await login({ email: form.email, password: form.password });
      nav(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth" onSubmit={submit}>
      <h1>{isRegister ? 'Create your account' : 'Log in'}</h1>
      {state?.from && <p className="muted small">Log in to continue with your booking.</p>}
      {isRegister && <label>Full name<input value={form.name} onChange={set('name')} required autoComplete="name" /></label>}
      <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
      <label>Password
        <input type="password" value={form.password} onChange={set('password')} required minLength={isRegister ? 8 : undefined}
          autoComplete={isRegister ? 'new-password' : 'current-password'} />
        {isRegister && <span className="muted small">At least 8 characters.</span>}
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Sign up' : 'Log in'}</button>
      <p className="muted small">
        {isRegister
          ? <>Already have an account? <Link to="/login" state={state} className="link">Log in</Link></>
          : <>New here? <Link to="/register" state={state} className="link">Create an account</Link></>}
      </p>
    </form>
  );
}
