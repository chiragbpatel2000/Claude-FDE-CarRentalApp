import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../lib/pricing';

export function CarImage({ car, large }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`car-img ${large ? 'large' : ''}`}
      style={{ background: `linear-gradient(135deg, ${car.color}33, ${car.color}99)` }}
    >
      {car.image && !failed ? (
        <img src={car.image} alt={car.name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span>{car.emoji}</span>
      )}
    </div>
  );
}

export default function CarCard({ car, search = '', priceLine = null }) {
  return (
    <Link to={`/cars/${car.id}${search}`} className="card car-card">
      <CarImage car={car} />
      <div className="card-body">
        <div className="row between">
          <h3>{car.name}</h3>
          <span className="tag">{car.category}</span>
        </div>
        <p className="muted small">
          {car.seats} seats · {car.transmission} · {car.fuel}
        </p>
        <div className="rates">
          <div><strong>{money(car.dailyRate)}</strong><span> /day</span></div>
          <div><strong>{money(car.weeklyRate)}</strong><span> /week</span></div>
        </div>
        {priceLine && <p className="trip-price">Your dates: <strong>{priceLine}</strong> + tax</p>}
      </div>
    </Link>
  );
}
