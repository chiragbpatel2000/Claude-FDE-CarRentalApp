import { useEffect, useMemo, useState } from 'react';
import AdminTabs from '../components/AdminTabs.jsx';
import { adminCancelBooking, adminGetBookings } from '../lib/api';
import { money, todayStr } from '../lib/pricing';

export default function AdminBookings() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [when, setWhen] = useState('all');

  const load = () => adminGetBookings().then(setBookings).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const today = todayStr();
  const visible = useMemo(() => {
    if (!bookings) return [];
    const q = query.trim().toLowerCase();
    return bookings.filter((b) =>
      (status === 'all' || b.status === status) &&
      (when === 'all' || (when === 'upcoming' ? b.endDate >= today : b.endDate < today)) &&
      (!q || [b.carName, b.customer.name, b.customer.email, b.customer.phone, b.account.email]
        .some((v) => v.toLowerCase().includes(q))));
  }, [bookings, query, status, when, today]);

  const confirmed = visible.filter((b) => b.status === 'confirmed');
  const revenue = confirmed.reduce((s, b) => s + b.total, 0);

  async function cancel(b) {
    if (!confirm(`Cancel ${b.carName} for ${b.customer.name} (${b.startDate} → ${b.endDate})? The car becomes available again.`)) return;
    setError('');
    try {
      await adminCancelBooking(b.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!bookings) return error ? <p className="error">{error}</p> : <p>Loading…</p>;

  return (
    <>
      <AdminTabs />
      <h1>All bookings</h1>

      <div className="card toolbar">
        <input placeholder="Search car, customer name, email or phone…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={when} onChange={(e) => setWhen(e.target.value)}>
          <option value="all">Any dates</option>
          <option value="upcoming">Current &amp; upcoming</option>
          <option value="past">Past</option>
        </select>
      </div>

      <div className="stats">
        <div className="stat"><strong>{visible.length}</strong>bookings shown</div>
        <div className="stat"><strong>{confirmed.length}</strong>confirmed</div>
        <div className="stat"><strong>{money(revenue)}</strong>confirmed value</div>
      </div>

      {error && <p className="error">{error}</p>}

      {visible.length === 0 ? <p className="muted">No bookings match.</p> : (
        <div className="card table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Car</th><th>Dates</th><th>Customer</th><th>Total</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.id} className={b.status === 'cancelled' ? 'inactive' : ''}>
                  <td>{b.carName}</td>
                  <td>{b.startDate} → {b.endDate}<span className="subtle">{b.days} day{b.days > 1 ? 's' : ''}</span></td>
                  <td>
                    {b.customer.name}
                    <span className="subtle">{b.customer.email} · {b.customer.phone}</span>
                    {b.account.email.toLowerCase() !== b.customer.email.toLowerCase() &&
                      <span className="subtle">Account: {b.account.email}</span>}
                  </td>
                  <td>{money(b.total)}</td>
                  <td><span className={`status ${b.status}`}>{b.status}</span></td>
                  <td className="actions">
                    {b.status === 'confirmed' && <button className="linkbtn danger" onClick={() => cancel(b)}>Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
