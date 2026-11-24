import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cancelBooking, getBookings } from '../lib/api';
import { money } from '../lib/pricing';

export default function Bookings() {
  const [bookings, setBookings] = useState(null);
  const { state } = useLocation();

  const [error, setError] = useState('');

  useEffect(() => { getBookings().then(setBookings).catch((e) => setError(e.message)); }, []);

  async function cancel(id) {
    if (!confirm('Cancel this booking?')) return;
    try {
      await cancelBooking(id);
      setBookings(await getBookings());
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !bookings) return <p className="error">{error}</p>;
  if (!bookings) return <p>Loading…</p>;

  return (
    <>
      <h1>My bookings</h1>
      {error && <p className="error">{error}</p>}
      {state?.justBooked && <p className="success">🎉 Booking confirmed!</p>}
      {bookings.length === 0 ? (
        <p className="muted">No bookings yet. <Link to="/">Browse cars</Link></p>
      ) : (
        <div className="list">
          {bookings.map((b) => (
            <div key={b.id} className={`card booking-item ${b.status}`}>
              <div>
                <h3>{b.carName} <span className={`status ${b.status}`}>{b.status}</span></h3>
                <p className="muted">{b.startDate} → {b.endDate} · {b.days} day{b.days > 1 ? 's' : ''}</p>
                <p className="small muted">{b.customer.name} · {b.customer.email}</p>
              </div>
              <div className="right">
                <strong>{money(b.total)}</strong>
                {b.status === 'confirmed' && <button className="btn secondary" onClick={() => cancel(b.id)}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
