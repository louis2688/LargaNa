"use client";

import { useMemo, useState } from "react";
import { Bell, Car, ChevronDown, Clock3, MapPin, Menu, Navigation, ShieldCheck, Star, X } from "lucide-react";

const rides = [
  { id: "go", name: "LargaGo", detail: "Everyday rides", eta: "3 min", fare: 129, seats: 4, color: "#e8a624" },
  { id: "plus", name: "LargaPlus", detail: "Extra comfort", eta: "5 min", fare: 188, seats: 4, color: "#237a62" },
  { id: "van", name: "LargaVan", detail: "For the whole crew", eta: "8 min", fare: 268, seats: 6, color: "#2a5b9e" }
];

export default function RideBooking() {
  const [pickup, setPickup] = useState("SM City Cebu, Cebu City");
  const [dropoff, setDropoff] = useState("IT Park, Cebu City");
  const [selected, setSelected] = useState("go");
  const [booked, setBooked] = useState(false);
  const selectedRide = useMemo(() => rides.find((ride) => ride.id === selected) ?? rides[0], [selected]);

  if (booked) {
    return (
      <main className="app-shell confirmation">
        <div className="confirmation-mark"><ShieldCheck size={38} /></div>
        <p className="eyebrow">Ride confirmed</p>
        <h1>Juan is on the way.</h1>
        <p className="confirmation-copy">Your {selectedRide.name} will arrive in about {selectedRide.eta}. We will let you know when it is outside.</p>
        <div className="driver-card">
          <div className="avatar">JD</div>
          <div><strong>Juan Dela Cruz</strong><span>Toyota Vios · ABC 1234</span></div>
          <div className="rating"><Star size={14} fill="currentColor" /> 4.9</div>
        </div>
        <button className="primary-button" onClick={() => setBooked(false)}>Back to booking</button>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header>
        <a className="brand" href="#top" aria-label="LargaNa home"><span>Larga</span>Na</a>
        <nav><a href="#rides">Rides</a><a href="#safety">Safety</a><a href="#help">Help</a></nav>
        <div className="header-actions"><button className="icon-button" aria-label="Notifications"><Bell size={19} /></button><button className="menu-button"><Menu size={18} /> Menu</button></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy"><p className="eyebrow">Good afternoon, Luis</p><h1>Where to?</h1><p>Move through your day with a ride that feels easy.</p></div>
        <div className="weather"><span>CEBU CITY</span><strong>31°</strong><small>Partly cloudy</small></div>
      </section>

      <section className="booking-layout" id="rides">
        <div className="booking-panel">
          <div className="location-fields">
            <div className="route-line" />
            <div className="field-row"><span className="pickup-dot" /><label><small>PICKUP</small><input value={pickup} onChange={(event) => setPickup(event.target.value)} /></label><Navigation size={17} /></div>
            <div className="field-row"><span className="dropoff-dot" /><label><small>DROPOFF</small><input value={dropoff} onChange={(event) => setDropoff(event.target.value)} /></label><MapPin size={18} /></div>
          </div>
          <button className="schedule"><Clock3 size={18} /><span>Leave now</span><ChevronDown size={16} /></button>
          <div className="ride-header"><h2>Choose a ride</h2><span>2.8 km</span></div>
          <div className="ride-list">
            {rides.map((ride) => <button key={ride.id} className={`ride-option ${selected === ride.id ? "selected" : ""}`} onClick={() => setSelected(ride.id)}>
              <span className="vehicle" style={{ backgroundColor: ride.color }}><Car size={23} /></span>
              <span className="ride-description"><strong>{ride.name}</strong><small>{ride.detail} · {ride.seats} seats</small></span>
              <span className="ride-price"><strong>P{ride.fare}</strong><small>{ride.eta}</small></span>
            </button>)}
          </div>
          <button className="primary-button" onClick={() => setBooked(true)}>Book {selectedRide.name} · P{selectedRide.fare}</button>
        </div>
        <div className="map-panel" aria-label="Map showing the route from SM City Cebu to IT Park">
          <div className="map-grid" />
          <div className="water water-one" /><div className="water water-two" />
          <span className="road r1" /><span className="road r2" /><span className="road r3" /><span className="road r4" />
          <svg className="route" viewBox="0 0 600 500" aria-hidden="true"><path d="M122 332 C200 300 188 235 270 230 S350 105 475 116" fill="none" stroke="#e8a624" strokeWidth="9" strokeLinecap="round" /></svg>
          <span className="map-label label-start">SM City Cebu</span><span className="map-label label-end">IT Park</span>
          <span className="map-pin start"><span /></span><span className="map-pin end"><X size={14} /></span>
          <div className="map-note"><strong>2.8 km · 12 min</strong><span>Light traffic</span></div>
        </div>
      </section>

      <section className="trust-strip" id="safety"><ShieldCheck size={22} /><p><strong>Safe rides, every time.</strong> Verified drivers, live trip sharing, and 24/7 support.</p><a href="#help">Learn about safety</a></section>
    </main>
  );
}
