"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CarFront,
  ChevronDown,
  ChevronLeft,
  Clock3,
  MapPin,
  Menu,
  Moon,
  Navigation,
  ShieldCheck,
  Star,
  Sun,
  UsersRound,
  X
} from "lucide-react";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";

const rides = [
  { id: "go", name: "LargaGo", detail: "Everyday rides", eta: "3 min", fare: 129, seats: 4, color: "amber" },
  { id: "plus", name: "LargaPlus", detail: "Extra comfort", eta: "5 min", fare: 188, seats: 4, color: "green" },
  { id: "van", name: "LargaVan", detail: "For the whole crew", eta: "8 min", fare: 268, seats: 6, color: "blue" }
];

function Brand() {
  return <a className="brand" href="#top" aria-label="LargaNa home"><span>Larga</span>Na</a>;
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"); }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  };
  return <Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "dark"} onClick={toggle}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</Button>;
}

function LocationField({ label, value, onChange, destination }: { label: string; value: string; onChange: (value: string) => void; destination?: boolean }) {
  const Icon = destination ? MapPin : Navigation;
  return <div className="location-field">
    <span className={destination ? "location-marker location-marker--destination" : "location-marker"} aria-hidden="true" />
    <label><span>{label}</span><Input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <Icon size={18} aria-hidden="true" />
  </div>;
}

export default function RideBooking() {
  const [pickup, setPickup] = useState("SM City Cebu, Cebu City");
  const [dropoff, setDropoff] = useState("IT Park, Cebu City");
  const [selected, setSelected] = useState("go");
  const [booked, setBooked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedRide = useMemo(() => rides.find((ride) => ride.id === selected) ?? rides[0], [selected]);

  if (booked) {
    return <main className="site-shell confirmation-shell">
      <header className="site-header"><Brand /><Button variant="ghost" size="icon" aria-label="Back to booking" onClick={() => setBooked(false)}><ChevronLeft size={20} /></Button><div className="header-controls"><ThemeToggle /></div></header>
      <section className="confirmation-wrap" aria-live="polite">
        <Card className="confirmation-card">
          <CardContent className="confirmation-content">
            <div className="confirmation-icon"><ShieldCheck size={32} /></div>
            <Badge variant="secondary">Ride confirmed</Badge>
            <h1>Juan is on the way.</h1>
            <p>Your {selectedRide.name} will arrive in about {selectedRide.eta}. We will let you know when it is outside.</p>
            <Separator />
            <div className="driver-summary">
              <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
              <div><strong>Juan Dela Cruz</strong><span>Toyota Vios · ABC 1234</span></div>
              <span className="driver-rating"><Star size={14} fill="currentColor" /> 4.9</span>
            </div>
          </CardContent>
          <CardFooter><Button className="wide-button" onClick={() => setBooked(false)}>Back to booking</Button></CardFooter>
        </Card>
      </section>
    </main>;
  }

  return <main className="site-shell">
    <header className="site-header">
      <Brand />
      <nav className="site-nav" id="primary-nav" data-open={menuOpen} aria-label="Primary navigation" onClick={() => setMenuOpen(false)}><a href="#rides">Book a ride</a><a href="#safety">Safety</a><a href="#support">Support</a></nav>
      <div className="header-controls">
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Notifications"><Bell size={19} /></Button>
        <Avatar className="profile-avatar" aria-label="Luis profile"><AvatarFallback>LM</AvatarFallback></Avatar>
        <Button variant="ghost" size="icon" className="menu-button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="primary-nav" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</Button>
      </div>
    </header>

    <section className="booking-heading" id="top">
      <div><Badge variant="secondary">Available in Cebu City</Badge><h1>Where are you going?</h1><p>Request a ride in a few taps. Upfront fares, verified drivers.</p></div>
      <div className="heading-meta"><span>Tuesday, 15 July</span><strong>31°</strong><small>Partly cloudy</small></div>
    </section>

    <section className="booking-layout" id="rides">
      <Card className="booking-card">
        <CardHeader>
          <div><CardTitle>Plan your ride</CardTitle><CardDescription>Enter your trip details to see available rides.</CardDescription></div>
          <Badge variant="outline">Now</Badge>
        </CardHeader>
        <CardContent>
          <div className="route-fields">
            <span className="route-line" aria-hidden="true" />
            <LocationField label="Pickup" value={pickup} onChange={setPickup} />
            <LocationField label="Dropoff" value={dropoff} onChange={setDropoff} destination />
          </div>
          <Button variant="outline" className="schedule-button"><Clock3 size={17} /><span>Leave now</span><ChevronDown size={16} /></Button>
          <Separator />
          <div className="ride-section-heading"><div><h2>Choose a ride</h2><p>2.8 km · about 12 min</p></div><Badge variant="outline">3 nearby</Badge></div>
          <div className="ride-list" role="radiogroup" aria-label="Ride type">
            {rides.map((ride) => <button key={ride.id} className="ride-option" data-state={selected === ride.id ? "active" : "inactive"} onClick={() => setSelected(ride.id)} role="radio" aria-checked={selected === ride.id}>
              <span className={`vehicle-mark vehicle-mark--${ride.color}`}><CarFront size={23} /></span>
              <span className="ride-copy"><strong>{ride.name}</strong><small>{ride.detail} · <UsersRound size={11} /> {ride.seats}</small></span>
              <span className="ride-cost"><strong>P{ride.fare}</strong><small>{ride.eta}</small></span>
            </button>)}
          </div>
        </CardContent>
        <CardFooter><Button className="wide-button" onClick={() => setBooked(true)}>Book {selectedRide.name}<span className="button-divider" />P{selectedRide.fare}</Button></CardFooter>
      </Card>

      <aside className="map-surface" aria-label="Map showing the route from SM City Cebu to IT Park">
        <div className="map-grid" /><div className="map-water map-water--one" /><div className="map-water map-water--two" />
        <span className="map-road map-road--one" /><span className="map-road map-road--two" /><span className="map-road map-road--three" />
        <svg className="map-route" viewBox="0 0 600 500" aria-hidden="true"><path d="M116 345 C195 316 182 249 271 236 S356 115 482 121" fill="none" stroke="#e4a832" strokeWidth="8" strokeLinecap="round" /></svg>
        <span className="map-label map-label--start">SM City Cebu</span><span className="map-label map-label--end">IT Park</span>
        <span className="map-pin map-pin--start"><span /></span><span className="map-pin map-pin--end"><X size={13} /></span>
        <div className="map-controls"><Badge>Light traffic</Badge><Button variant="secondary" size="icon" aria-label="Center on your location"><Navigation size={17} /></Button></div>
        <div className="map-trip-detail"><strong>2.8 km · 12 min</strong><span>Pickup in about 3 minutes</span></div>
      </aside>
    </section>

    <section className="safety-strip" id="safety"><span className="safety-icon"><ShieldCheck size={22} /></span><div><strong>Safer rides, every time.</strong><p>Share your trip, check driver details, and reach 24/7 support whenever you need it.</p></div><Button variant="link" size="sm" id="support">Safety features</Button></section>
  </main>;
}
