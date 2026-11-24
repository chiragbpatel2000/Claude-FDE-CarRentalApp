import { NavLink, Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CarDetail from './pages/CarDetail.jsx';
import Bookings from './pages/Bookings.jsx';
import Auth from './pages/Auth.jsx';
import Admin from './pages/Admin.jsx';
import AdminBookings from './pages/AdminBookings.jsx';
import { useAuth } from './lib/auth.jsx';

function RequireAuth({ children, admin = false }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (admin && user.role !== 'admin') return <p className="error">You don't have access to this page. <Link to="/">Go home</Link></p>;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">🚘 DriveEasy</Link>
        <nav>
          <NavLink to="/" end>Browse cars</NavLink>
          <NavLink to="/bookings">My bookings</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          {user ? (
            <>
              <span className="who">Hi, {user.name.split(' ')[0]}</span>
              <button className="linkbtn" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Sign up</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cars/:id" element={<CarDetail />} />
          <Route path="/bookings" element={<RequireAuth><Bookings /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="/admin/bookings" element={<RequireAuth admin><AdminBookings /></RequireAuth>} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>
      <footer className="footer">Car photos via Wikimedia Commons (CC-licensed). Demo app: no payments are taken.</footer>
    </>
  );
}
