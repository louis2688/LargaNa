"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ACTIVE_RIDE_STATUSES, RIDE_STATUS_LABEL, formatPeso, type Database, type Tables } from "@largana/core";
import { CarFront, ChevronDown, Clock3, MapPin, Navigation, Search, ShieldCheck, Star, UsersRound, X } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { SignInForm } from "../components/sign-in-form";
import { SiteHeader } from "../components/site-header";
import { supabase } from "../lib/supabase";

// ponytail: fixed Cebu coordinates until Places autocomplete lands; the address text is free-form.
const PICKUP = { lat: 10.3111, lng: 123.9186 };
const DROPOFF = { lat: 10.33, lng: 123.906 };
const TIER_COLOR: Record<string, string> = { go: "amber", plus: "green", van: "blue" };

type Quote = Database["public"]["Functions"]["fare_quote"]["Returns"][number];
type Ride = Tables<"rides">;
const loadDriver = (id: string) =>
  supabase.from("driver_profiles").select("plate_number, vehicle_make, vehicle_model, vehicle_color, rating, profiles(full_name)").eq("user_id", id).single();
type Driver = NonNullable<Awaited<ReturnType<typeof loadDriver>>["data"]>;

const minutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;
const km = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

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
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selected, setSelected] = useState("go");
  const [session, setSession] = useState<Session | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [rated, setRated] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const quote = quotes.find((q) => q.tier_id === selected) ?? quotes[0];

  // Live fares, nearby drivers and ETAs, refreshed every 15 s.
  useEffect(() => {
    const load = () => supabase.rpc("fare_quote", { pickup_lat: PICKUP.lat, pickup_lng: PICKUP.lng, dropoff_lat: DROPOFF.lat, dropoff_lng: DROPOFF.lng })
      .then(({ data, error }) => { if (error) setError(error.message); else setQuotes(data); });
    load();
    const timer = setInterval(load, 15000);
    setToday(new Date().toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long" }));
    return () => clearInterval(timer);
  }, []);

  // Session, and the rider's active ride if the page was reloaded mid-trip.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setRide(null); return; }
    supabase.from("rides").select("*").eq("rider_id", uid).in("status", [...ACTIVE_RIDE_STATUSES])
      .order("requested_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setRide(data); });
  }, [uid]);

  // Follow the ride over Realtime; load the driver card once one is assigned.
  const rideId = ride?.id;
  const driverId = ride?.driver_id;
  useEffect(() => {
    if (!rideId) return;
    const channel = supabase.channel(`ride:${rideId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, (payload) => setRide(payload.new as Ride))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rideId]);
  useEffect(() => {
    if (!driverId) { setDriver(null); return; }
    loadDriver(driverId).then(({ data }) => setDriver(data));
  }, [driverId]);

  const book = async () => {
    if (!session) { setAuthOpen(true); return; }
    if (!quote) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("request_ride", {
      tier_id: quote.tier_id, pickup_lat: PICKUP.lat, pickup_lng: PICKUP.lng, pickup_address: pickup,
      dropoff_lat: DROPOFF.lat, dropoff_lng: DROPOFF.lng, dropoff_address: dropoff
    });
    setBusy(false);
    if (error) setError(error.message);
    else { setRide(data); setRated(false); }
  };
  const cancel = async () => {
    if (!ride) return;
    const { data, error } = await supabase.rpc("cancel_ride", { ride_id: ride.id });
    if (error) setError(error.message); else setRide(data);
  };
  const rate = async (stars: number) => {
    if (!ride) return;
    const { error } = await supabase.rpc("rate_ride", { ride_id: ride.id, stars });
    if (error) setError(error.message); else setRated(true);
  };

  const header = <SiteHeader session={session} onSignIn={() => setAuthOpen(true)} onSignOut={() => supabase.auth.signOut()} />;

  if (ride) {
    const status = ride.status;
    const active = (ACTIVE_RIDE_STATUSES as readonly string[]).includes(status);
    const driverName = driver?.profiles?.full_name ?? "Your driver";
    const headline = {
      requested: "Finding your driver…", accepted: `${driverName} is on the way.`, arrived: `${driverName} is outside.`,
      in_progress: `On the way to ${ride.dropoff_address}.`, completed: "You've arrived.", no_driver: "No drivers available right now.",
      cancelled_by_rider: "Ride cancelled.", cancelled_by_driver: "Your driver had to cancel."
    }[status];
    const copy = {
      requested: "We're offering your ride to the nearest drivers.", accepted: "We'll let you know when they're outside.",
      arrived: "Look for the plate number below.", in_progress: `Fare ${formatPeso(ride.quoted_fare)}, cash.`,
      completed: `${formatPeso(ride.final_fare ?? ride.quoted_fare)} cash. Thanks for riding with LargaNa.`,
      no_driver: "Try again in a moment or pick another ride type.", cancelled_by_rider: "No charge.", cancelled_by_driver: "No charge. Book again to find another driver."
    }[status];
    return <main className="site-shell confirmation-shell">
      {header}
      <section className="confirmation-wrap" aria-live="polite">
        <Card className="confirmation-card">
          <CardContent className="confirmation-content">
            <div className="confirmation-icon">{status === "requested" ? <Search size={30} /> : status === "no_driver" || status.startsWith("cancelled") ? <X size={30} /> : <ShieldCheck size={32} />}</div>
            <Badge variant="secondary">{RIDE_STATUS_LABEL[status]}</Badge>
            <h1>{headline}</h1>
            <p>{copy}</p>
            {driver && <>
              <Separator />
              <div className="driver-summary">
                <span className="ui-avatar"><span className="ui-avatar-fallback">{driverName.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span></span>
                <div><strong>{driverName}</strong><span>{driver.vehicle_color} {driver.vehicle_make} {driver.vehicle_model} · {driver.plate_number}</span></div>
                <span className="driver-rating"><Star size={14} fill="currentColor" /> {Number(driver.rating).toFixed(1)}</span>
              </div>
            </>}
            {status === "completed" && driver && <div className="stars" role="group" aria-label="Rate your driver">
              {rated ? <p className="form-hint">Thanks for the rating!</p> : [1, 2, 3, 4, 5].map((n) => <Button key={n} variant="ghost" size="icon" aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => rate(n)}><Star size={22} /></Button>)}
            </div>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </CardContent>
          <CardFooter className="trip-actions">
            {active && status !== "in_progress" && <Button variant="outline" className="wide-button" onClick={cancel}>Cancel ride</Button>}
            {!active && <Button className="wide-button" onClick={() => setRide(null)}>Book another ride</Button>}
          </CardFooter>
        </Card>
      </section>
    </main>;
  }

  return <main className="site-shell">
    {header}

    <section className="booking-heading" id="top">
      <div><Badge variant="secondary">Available in Cebu City</Badge><h1>Where are you going?</h1><p>Request a ride in a few taps. Upfront fares, verified drivers.</p></div>
      <div className="heading-meta"><span>{today}</span><strong>{quote ? quote.nearby : "–"}</strong><small>drivers nearby</small></div>
    </section>

    <section className="booking-layout" id="rides">
      {authOpen && !session ? <Card className="booking-card">
        <CardHeader><div><CardTitle>Sign in to book</CardTitle><CardDescription>Your ride is saved to your account so you can track it from any device.</CardDescription></div><Button variant="ghost" size="icon" aria-label="Close" onClick={() => setAuthOpen(false)}><X size={18} /></Button></CardHeader>
        <CardContent><SignInForm onDone={() => setAuthOpen(false)} hint="Demo: rider@largana.demo / largana-demo" /></CardContent>
      </Card> : <Card className="booking-card">
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
          <div className="ride-section-heading">
            <div><h2>Choose a ride</h2><p>{quote ? `${km(quote.distance_m)} · about ${minutes(quote.duration_s)}` : "Loading fares…"}</p></div>
            <Badge variant="outline">{quote ? `${quote.nearby} nearby` : "…"}</Badge>
          </div>
          <div className="ride-list" role="radiogroup" aria-label="Ride type">
            {quotes.map((q) => <button key={q.tier_id} className="ride-option" data-state={selected === q.tier_id ? "active" : "inactive"} onClick={() => setSelected(q.tier_id)} role="radio" aria-checked={selected === q.tier_id}>
              <span className={`vehicle-mark vehicle-mark--${TIER_COLOR[q.tier_id] ?? "green"}`}><CarFront size={23} /></span>
              <span className="ride-copy"><strong>{q.name}</strong><small>{q.description} · <UsersRound size={11} /> {q.seats}</small></span>
              <span className="ride-cost"><strong>{formatPeso(q.fare)}</strong><small>{q.eta_s == null ? "no drivers" : minutes(q.eta_s)}</small></span>
            </button>)}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </CardContent>
        <CardFooter><Button className="wide-button" disabled={!quote || busy} onClick={book}>{busy ? "Requesting…" : quote ? <>Book {quote.name}<span className="button-divider" />{formatPeso(quote.fare)}</> : "Loading…"}</Button></CardFooter>
      </Card>}

      <aside className="map-surface" aria-label="Map showing the route from SM City Cebu to IT Park">
        <div className="map-grid" /><div className="map-water map-water--one" /><div className="map-water map-water--two" />
        <span className="map-road map-road--one" /><span className="map-road map-road--two" /><span className="map-road map-road--three" />
        <svg className="map-route" viewBox="0 0 600 500" aria-hidden="true"><path d="M116 345 C195 316 182 249 271 236 S356 115 482 121" fill="none" stroke="#e4a832" strokeWidth="8" strokeLinecap="round" /></svg>
        <span className="map-label map-label--start">SM City Cebu</span><span className="map-label map-label--end">IT Park</span>
        <span className="map-pin map-pin--start"><span /></span><span className="map-pin map-pin--end"><X size={13} /></span>
        <div className="map-controls"><Badge>{quote && quote.nearby > 0 ? `${quote.nearby} driver${quote.nearby > 1 ? "s" : ""} nearby` : "No drivers nearby"}</Badge><Button variant="secondary" size="icon" aria-label="Center on your location"><Navigation size={17} /></Button></div>
        <div className="map-trip-detail"><strong>{quote ? `${km(quote.distance_m)} · ${minutes(quote.duration_s)}` : "…"}</strong><span>{quote?.eta_s != null ? `Pickup in about ${minutes(quote.eta_s)}` : "No drivers nearby yet"}</span></div>
      </aside>
    </section>

    <section className="safety-strip" id="safety"><span className="safety-icon"><ShieldCheck size={22} /></span><div><strong>Safer rides, every time.</strong><p>Share your trip, check driver details, and reach 24/7 support whenever you need it.</p></div><Button variant="link" size="sm" id="support">Safety features</Button></section>
  </main>;
}
