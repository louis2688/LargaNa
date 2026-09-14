import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Location from "expo-location";
import { DEMO_PICKUP, DRIVER_NEXT_STEP, RIDE_STATUS_LABEL, formatPeso, km, type Ride, type Tables } from "@largana/core";
import { Button } from "./button";
import { supabase } from "../lib/supabase";
import { color, ui } from "../lib/theme";

type DriverProfile = Tables<"driver_profiles">;
const loadOffers = (uid: string) => supabase.from("ride_offers").select("*, rides(*)").eq("driver_id", uid).eq("response", "pending");
type Offer = NonNullable<Awaited<ReturnType<typeof loadOffers>>["data"]>[number];
type Resp = { data: unknown; error: { message: string } | null };

export function DriverHome({ uid }: { uid: string }) {
  const [profile, setProfile] = useState<DriverProfile | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [ride, setRide] = useState<Ride | null>(null);
  const [riderName, setRiderName] = useState<string | null>(null);
  const [useGps, setUseGps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const position = useRef({ lat: DEMO_PICKUP.lat, lng: DEMO_PICKUP.lng });

  // Driver profile and any trip already in progress.
  useEffect(() => {
    supabase.from("driver_profiles").select("*").eq("user_id", uid).maybeSingle().then(({ data }) => setProfile(data));
    supabase.from("rides").select("*").eq("driver_id", uid).in("status", ["accepted", "arrived", "in_progress"]).maybeSingle().then(({ data }) => setRide(data));
  }, [uid]);

  // Pending offers, kept live.
  useEffect(() => {
    const load = () => loadOffers(uid).then(({ data }) => setOffers(data ?? []));
    load();
    const channel = supabase.channel(`offers:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers", filter: `driver_id=eq.${uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid]);

  // Publish a position every 5 s while online: GPS when enabled, otherwise the demo pickup so offers still arrive.
  // ponytail: foreground only; background location needs a dev build and a task.
  const online = profile?.is_online ?? false;
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    let watch: Location.LocationSubscription | undefined;
    position.current = { lat: DEMO_PICKUP.lat, lng: DEMO_PICKUP.lng };
    if (useGps) {
      Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
        if (status !== "granted") { setError("Location permission denied, using the demo location."); setUseGps(false); return; }
        const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
          (p) => { position.current = { lat: p.coords.latitude, lng: p.coords.longitude }; });
        if (cancelled) sub.remove(); else watch = sub;
      });
    }
    const publish = () => supabase.rpc("update_driver_location", { lat: position.current.lat, lng: position.current.lng })
      .then(({ error }) => { if (error) setError(error.message); });
    publish();
    const timer = setInterval(publish, 5000);
    return () => { cancelled = true; clearInterval(timer); watch?.remove(); };
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
  const setOnline = async (next: boolean) => {
    const result = await call(supabase.rpc("set_driver_online", { online: next }));
    if (result !== null && profile) setProfile({ ...profile, is_online: result });
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

  if (profile === undefined) return <ActivityIndicator style={styles.loading} color={color.primary} />;
  if (profile === null) return <View style={styles.page}><Text style={ui.body}>This account isn&apos;t registered as a driver.</Text></View>;
  const step = ride ? DRIVER_NEXT_STEP[ride.status] : undefined;

  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.heading}>
      <Text style={ui.overline}>DRIVER</Text>
      <Text style={ui.title}>{online ? "You're online" : "You're offline"}</Text>
    </View>

    <View style={ui.card}>
      <Text style={styles.strong}>{profile.vehicle_color} {profile.vehicle_make} {profile.vehicle_model} · {profile.plate_number}</Text>
      <Text style={ui.hint}>{profile.status === "approved" ? `Approved driver · ${Number(profile.rating).toFixed(1)} ★` : `Status: ${profile.status}`}</Text>
      <View style={styles.switchRow}>
        <Text style={styles.strong}>Online</Text>
        <Switch accessibilityLabel="Online" value={online} onValueChange={setOnline} disabled={profile.status !== "approved" || !!ride} trackColor={{ true: color.primary, false: color.border }} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.strong}>Use my GPS</Text>
        <Switch accessibilityLabel="Use my GPS" value={useGps} onValueChange={setUseGps} trackColor={{ true: color.primary, false: color.border }} />
      </View>
      {!useGps && <Text style={ui.hint}>GPS off: you&apos;re placed at SM City Cebu so test offers reach you.</Text>}
    </View>

    {ride ? <View style={ui.card}>
      <View style={styles.switchRow}>
        <Text style={styles.title}>{riderName ?? "Rider"}</Text>
        <View style={ui.badge}><Text style={ui.badgeText}>{RIDE_STATUS_LABEL[ride.status]}</Text></View>
      </View>
      <Text style={ui.hint}>{ride.pickup_address} → {ride.dropoff_address}</Text>
      <Text style={styles.fare}>{formatPeso(ride.quoted_fare)} <Text style={ui.hint}>cash · {km(ride.distance_m)}</Text></Text>
      {step && <Button title={step.label} onPress={() => advance(step.to)} />}
      {(ride.status === "accepted" || ride.status === "arrived") && <Button variant="outline" title="Cancel ride" onPress={cancel} />}
      {!step && <Button variant="outline" title="Done" onPress={() => setRide(null)} />}
    </View> : <View style={ui.card}>
      <Text style={styles.title}>Ride offers</Text>
      <Text style={ui.hint}>{online ? "Offers appear here the moment a rider requests nearby." : "Go online to receive offers."}</Text>
      {offers.length === 0 ? <Text style={ui.hint}>No offers right now.</Text> : offers.map((offer) => <View key={offer.id} style={styles.offer}>
        <Text style={styles.fare}>{offer.rides ? formatPeso(offer.rides.quoted_fare) : "New ride"} <Text style={ui.hint}>{offer.rides ? km(offer.rides.distance_m) : ""}</Text></Text>
        <Text style={ui.hint}>{offer.rides ? `${offer.rides.pickup_address} → ${offer.rides.dropoff_address}` : "Loading ride…"}</Text>
        <View style={ui.row}>
          <Button title="Accept" onPress={() => accept(offer)} style={styles.flex} />
          <Button variant="outline" title="Decline" onPress={() => decline(offer)} style={styles.flex} />
        </View>
      </View>)}
    </View>}

    {error && <Text style={ui.error}>{error}</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: 80 },
  page: { gap: 14, padding: 20 },
  heading: { gap: 6, paddingTop: 4 },
  strong: { fontSize: 15, fontWeight: "700", color: color.text },
  title: { fontSize: 18, fontWeight: "800", color: color.text },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  fare: { fontSize: 18, fontWeight: "800", color: color.text },
  offer: { gap: 8, padding: 14, borderWidth: 1, borderColor: color.border, borderRadius: 12 }
});
