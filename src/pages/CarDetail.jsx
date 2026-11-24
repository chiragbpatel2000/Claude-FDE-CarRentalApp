import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CarImage } from '../components/CarCard.jsx';
import { createBooking, getCar, isRangeFree } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { EXTRAS, countDays, money, quote, todayStr } from '../lib/pricing';

export default function CarDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [car, setCar] = useState(undefined);
  const { user } = useAuth();
  const loc = useLocation();
  const [start, setStart] = useState(params.get('start') || todayStr(1));
  const [end, setEnd] = useState(params.get('end') || todayStr(3));
  const [extras, setExtras] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState('');

  const refreshCar = () => getCar(id).then(setCar).catch(() => setCar(null));
  useEffect(() => { refreshCar(); }, [id]);

  // Prefill contact details from the account (only fills blanks).
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name, email: f.email || user.email }));
  }, [user]);

  if (car === undefined) return <p>Loading…</p>;
  if (car === null) return <p>Car not found. <Link to="/">Back to browse</Link></p>;

  const days = countDays(start, end);
  const datesValid = days >= 1 && start >= todayStr();
  const available = datesValid && isRangeFree(car.bookedRanges, start, end);
  const perDayExtras = EXTRAS.filter((e) => extras.includes(e.id)).reduce((s, e) => s + e.perDay, 0);
  const q = datesValid ? quote(car, days, perDayExtras) : null;

  const toggleExtra = (eid) => setExtras((x) => (x.includes(eid) ? x.filter((i) => i !== eid) : [...x, eid]));
  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!user) {
      nav('/login', { state: { from: `${loc.pathname}?start=${start}&end=${end}` } });
      return;
    }
    try {
      await createBooking({
        carId: car.id, carName: car.name, startDate: start, endDate: end, days,
        extras, customer: form, total: q.total,
      });
      nav('/bookings', { state: { justBooked: true } });
    } catch (err) {
      setError(err.message);
      refreshCar();
    }
  }

  return (
    <>
      <Link to="/" className="back">← All cars</Link>
      <div className="detail">
        <div>
          <CarImage car={car} large />
          <h1>{car.name} <span className="tag">{car.category}</span></h1>
          <div className="specs">
            <div><span>👥</span>{car.seats} seats</div>
            <div><span>⚙️</span>{car.transmission}</div>
            <div><span>⛽</span>{car.fuel}</div>
            <div><span>🧳</span>{car.bags} bags</div>
            <div><span>📈</span>{car.mpg} {car.fuel === 'Electric' ? 'MPGe' : 'MPG'}</div>
          </div>
          <h3>Features</h3>
          <ul className="features">{car.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
          <h3>Rates</h3>
          <table className="rate-table">
            <tbody>
              <tr><td>Daily</td><td>{money(car.dailyRate)}</td></tr>
              <tr><td>Weekly (7 days)</td><td>{money(car.weeklyRate)} <span className="save">save {money(car.dailyRate * 7 - car.weeklyRate)}</span></td></tr>
            </tbody>
          </table>
        </div>

        <form className="card booking" onSubmit={submit}>
          <h2>Book this car</h2>
          <div className="two">
            <label>Pick-up
              <input type="date" min={todayStr()} value={start}
                onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} required />
            </label>
            <label>Return
              <input type="date" min={start || todayStr()} value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>

          {!datesValid && <p className="error">Choose valid dates (today or later, return on/after pick-up).</p>}
          {datesValid && !available && <p className="error">Not available for these dates. Try different dates.</p>}

          <fieldset>
            <legend>Extras</legend>
            {EXTRAS.map((x) => (
              <label key={x.id} className="check">
                <input type="checkbox" checked={extras.includes(x.id)} onChange={() => toggleExtra(x.id)} />
                {x.label} <span className="muted">+{money(x.perDay)}/day</span>
              </label>
            ))}
          </fieldset>

          <label>Full name<input value={form.name} onChange={setField('name')} required /></label>
          <label>Email<input type="email" value={form.email} onChange={setField('email')} required /></label>
          <label>Phone<input type="tel" value={form.phone} onChange={setField('phone')} required /></label>

          {q && (
            <div className="summary">
              <div className="row between">
                <span>{days} day{days > 1 ? 's' : ''}{q.weeks > 0 && ` (${q.weeks} wk${q.weeks > 1 ? 's' : ''}${q.rem ? ` + ${q.rem} d` : ''})`}</span>
                <span>{money(q.base)}</span>
              </div>
              {q.extras > 0 && <div className="row between"><span>Extras</span><span>{money(q.extras)}</span></div>}
              <div className="row between"><span>Tax (10%)</span><span>{money(q.tax)}</span></div>
              {q.savings > 0 && <div className="save">You save {money(q.savings)} with weekly pricing</div>}
              <div className="row between total"><span>Total</span><span>{money(q.total)}</span></div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={!available}>{user ? 'Confirm booking' : 'Log in to book'}</button>
          <p className="muted small">No payment is taken in this demo.</p>
        </form>
      </div>
    </>
  );
}
