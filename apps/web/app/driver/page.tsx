"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { DEMO_PICKUP, DRIVER_NEXT_STEP, RIDE_STATUS_LABEL, formatPeso, km, type Ride, type Tables } from "@largana/core";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { SignInForm } from "../../components/sign-in-form";
import { SiteHeader } from "../../components/site-header";
import { supabase } from "../../lib/supabase";

type DriverProfile = Tables<"driver_profiles">;
const loadOffers = (uid: string) => supabase.from("ride_offers").select("*, rides(*)").eq("driver_id", uid).eq("response", "pending");
type Offer = NonNullable<Awaited<ReturnType<typeof loadOffers>>["data"]>[number];
type Resp = { data: unknown; error: { message: string } | null };

// ponytail: demo drivers sit at the demo pickup; tick "Use my GPS" to publish the browser's real position.
const DEMO_LOCATION = { lat: DEMO_PICKUP.lat, lng: DEMO_PICKUP.lng };

export default function DriverPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [ride, setRide] = useState<Ride | null>(null);
  const [riderName, setRiderName] = useState<string | null>(null);
  const [useGps, setUseGps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const position = useRef(DEMO_LOCATION);
  const uid = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Driver profile and any trip already in progress.
  useEffect(() => {
    if (!uid) { setProfile(undefined); setRide(null); setOffers([]); return; }
    supabase.from("driver_profiles").select("*").eq("user_id", uid).maybeSingle().then(({ data }) => setProfile(data));
    supabase.from("rides").select("*").eq("driver_id", uid).in("status", ["accepted", "arrived", "in_progress"]).maybeSingle().then(({ data }) => setRide(data));
  }, [uid]);

  // Pending offers, kept live.
  useEffect(() => {
    if (!uid) return;
    const load = () => loadOffers(uid).then(({ data }) => setOffers(data ?? []));
    load();
    const channel = supabase.channel(`offers:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers", filter: `driver_id=eq.${uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid]);

  // Publish a position every 5 s while online.
  const online = profile?.is_online ?? false;
  useEffect(() => {
    if (!online) return;
    let watch: number | undefined;
    if (useGps && navigator.geolocation) watch = navigator.geolocation.watchPosition((p) => { position.current = { lat: p.coords.latitude, lng: p.coords.longitude }; });
    else position.current = DEMO_LOCATION;
    const publish = () => supabase.rpc("update_driver_location", position.current).then(({ error }) => { if (error) setError(error.message); });
    publish();
    const timer = setInterval(publish, 5000);
    return () => { clearInterval(timer); if (watch !== undefined) navigator.geolocation.clearWatch(watch); };
  }, [online, useGps]);

  // Follow the active ride (rider cancellations arrive here) and show who's riding.
  const rideId = ride?.id;
  const riderId = ride?.rider_id;
  useEffect(() => {
    if (!rideId) return;
    const channel = supabase.channel(`ride:${rideId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, (payload) => setRide(payload.new as Ride))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rideId]);
  useEffect(() => {
    if (!riderId) { setRiderName(null); return; }
    supabase.from("profiles").select("full_name").eq("id", riderId).single().then(({ data }) => setRiderName(data?.full_name ?? null));
  }, [riderId]);

  const call = async <R extends Resp>(p: PromiseLike<R>) => {
    const { data, error } = await p;
    if (error) { setError(error.message); return null; }
    setError(null);
    return data as Extract<R, { error: null }>["data"];
  };
  const toggleOnline = async () => {
    const next = await call(supabase.rpc("set_driver_online", { online: !online }));
    if (next !== null && profile) setProfile({ ...profile, is_online: next });
  };
  const accept = async (offer: Offer) => {
    const accepted = await call(supabase.rpc("accept_ride", { ride_id: offer.ride_id }));
    if (accepted) { setRide(accepted); setOffers([]); }
  };
  const decline = (offer: Offer) => call(supabase.rpc("decline_offer", { ride_id: offer.ride_id }));
  const advance = async (to: Ride["status"]) => {
    if (!ride) return;
    const next = await call(supabase.rpc("advance_ride", { ride_id: ride.id, to_status: to }));
    if (next) setRide(next);
  };
  const cancel = async () => {
    if (!ride) return;
    const next = await call(supabase.rpc("cancel_ride", { ride_id: ride.id, reason: "driver cancelled" }));
    if (next) setRide(next);
  };

  const step = ride ? DRIVER_NEXT_STEP[ride.status] : undefined;

  return <main className="site-shell">
    <SiteHeader session={session} onSignIn={() => {}} onSignOut={() => supabase.auth.signOut()} />
    <section className="driver-shell">
      {!session ? <Card>
        <CardHeader><div><CardTitle>Driver sign in</CardTitle><CardDescription>Go online to receive ride offers.</CardDescription></div></CardHeader>
        <CardContent><SignInForm hint="Demo: driver@largana.demo / largana-demo" /></CardContent>
      </Card>
      : profile === undefined ? <p className="form-hint">Loading…</p>
      : profile === null ? <Card><CardContent>This account isn&apos;t registered as a driver.</CardContent></Card>
      : <>
        <Card>
          <CardHeader>
            <div><CardTitle>{profile.vehicle_color} {profile.vehicle_make} {profile.vehicle_model} · {profile.plate_number}</CardTitle><CardDescription>{profile.status === "approved" ? `Approved driver · ${Number(profile.rating).toFixed(1)} ★` : `Status: ${profile.status}`}</CardDescription></div>
            <Badge variant={online ? "default" : "outline"}>{online ? "Online" : "Offline"}</Badge>
          </CardHeader>
          <CardContent className="driver-row">
            <label className="switch"><input type="checkbox" checked={useGps} onChange={(e) => setUseGps(e.target.checked)} /> Use my GPS (otherwise SM City Cebu)</label>
            <Button variant={online ? "outline" : "default"} onClick={toggleOnline} disabled={profile.status !== "approved" || !!ride}>{online ? "Go offline" : "Go online"}</Button>
          </CardContent>
        </Card>

        {ride ? <Card>
          <CardHeader>
            <div><CardTitle>{riderName ?? "Rider"}</CardTitle><CardDescription>{ride.pickup_address} → {ride.dropoff_address}</CardDescription></div>
            <Badge variant="secondary">{RIDE_STATUS_LABEL[ride.status]}</Badge>
          </CardHeader>
          <CardContent className="trip-actions">
            <p className="offer-fare"><strong>{formatPeso(ride.quoted_fare)}</strong> <small>cash · {km(ride.distance_m)}</small></p>
            {step && <Button className="wide-button" onClick={() => advance(step.to)}>{step.label}</Button>}
            {(ride.status === "accepted" || ride.status === "arrived") && <Button variant="outline" className="wide-button" onClick={cancel}>Cancel ride</Button>}
            {!step && <Button variant="outline" className="wide-button" onClick={() => setRide(null)}>Done</Button>}
          </CardContent>
        </Card> : <Card>
          <CardHeader><div><CardTitle>Ride offers</CardTitle><CardDescription>{online ? "Offers appear here the moment a rider requests nearby." : "Go online to receive offers."}</CardDescription></div></CardHeader>
          <CardContent>
            {offers.length === 0 ? <p className="form-hint">No offers right now.</p> : <div className="offers">
              {offers.map((offer) => <div key={offer.id} className="offer">
                <strong>{offer.rides ? formatPeso(offer.rides.quoted_fare) : "New ride"} <small>· {offer.rides ? km(offer.rides.distance_m) : ""}</small></strong>
                <small>{offer.rides ? `${offer.rides.pickup_address} → ${offer.rides.dropoff_address}` : "Loading ride…"}</small>
                <div className="offer-actions"><Button onClick={() => accept(offer)}>Accept</Button><Button variant="outline" onClick={() => decline(offer)}>Decline</Button></div>
              </div>)}
            </div>}
          </CardContent>
        </Card>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </>}
    </section>
  </main>;
}
