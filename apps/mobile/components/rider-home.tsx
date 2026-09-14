import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import {
  ACTIVE_RIDE_STATUSES, DEMO_DROPOFF, DEMO_PICKUP, RIDE_STATUS_LABEL,
  formatPeso, initials, isActive, km, minutes, riderTripCopy, type Quote, type Ride
} from "@largana/core";
import { Button } from "./button";
import { supabase } from "../lib/supabase";
import { color, ui } from "../lib/theme";

const loadDriver = (id: string) =>
  supabase.from("driver_profiles").select("plate_number, vehicle_make, vehicle_model, vehicle_color, rating, profiles(full_name)").eq("user_id", id).single();
type Driver = NonNullable<Awaited<ReturnType<typeof loadDriver>>["data"]>;

const TIER_COLOR: Record<string, string> = { go: color.amber, plus: color.primary, van: color.blue };

export function RiderHome({ session }: { session: Session }) {
  const uid = session.user.id;
  const firstName = String(session.user.user_metadata?.full_name ?? "").split(" ")[0];
  const [pickup, setPickup] = useState<string>(DEMO_PICKUP.address);
  const [dropoff, setDropoff] = useState<string>(DEMO_DROPOFF.address);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selected, setSelected] = useState("go");
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [rated, setRated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quote = quotes.find((q) => q.tier_id === selected) ?? quotes[0];

  // Live fares, nearby drivers and ETAs, refreshed every 15 s.
  useEffect(() => {
    const load = () => supabase.rpc("fare_quote", { pickup_lat: DEMO_PICKUP.lat, pickup_lng: DEMO_PICKUP.lng, dropoff_lat: DEMO_DROPOFF.lat, dropoff_lng: DEMO_DROPOFF.lng })
      .then(({ data, error }) => { if (error) setError(error.message); else setQuotes(data); });
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  // Resume a ride that was already in progress when the app opened.
  useEffect(() => {
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
    if (!quote) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("request_ride", {
      tier_id: quote.tier_id, pickup_lat: DEMO_PICKUP.lat, pickup_lng: DEMO_PICKUP.lng, pickup_address: pickup,
      dropoff_lat: DEMO_DROPOFF.lat, dropoff_lng: DEMO_DROPOFF.lng, dropoff_address: dropoff
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

  if (ride) {
    const driverName = driver?.profiles?.full_name ?? "Your driver";
    const { headline, copy } = riderTripCopy(ride, driverName);
    const active = isActive(ride.status);
    const icon = ride.status === "requested" ? "search" : active || ride.status === "completed" ? "shield-checkmark" : "close";
    return <ScrollView contentContainerStyle={styles.trip}>
      <View style={styles.tripIcon}><Ionicons name={icon} size={32} color={color.primary} /></View>
      <View style={[ui.badge, styles.center]}><Text style={ui.badgeText}>{RIDE_STATUS_LABEL[ride.status]}</Text></View>
      <Text style={[ui.title, styles.textCenter]}>{headline}</Text>
      <Text style={[ui.body, styles.textCenter]}>{copy}</Text>
      {driver && <View style={styles.driver}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(driverName)}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.driverName}>{driverName}</Text>
          <Text style={ui.hint}>{driver.vehicle_color} {driver.vehicle_make} {driver.vehicle_model} · {driver.plate_number}</Text>
        </View>
        <Text style={styles.rating}>★ {Number(driver.rating).toFixed(1)}</Text>
      </View>}
      {ride.status === "completed" && driver && (rated
        ? <Text style={[ui.hint, styles.textCenter]}>Thanks for the rating!</Text>
        : <View style={[ui.row, styles.center]} accessibilityLabel="Rate your driver">
          {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`} hitSlop={6} onPress={() => rate(n)}>
            <Ionicons name="star-outline" size={30} color={color.amber} />
          </Pressable>)}
        </View>)}
      {error && <Text style={ui.error}>{error}</Text>}
      {active && ride.status !== "in_progress" && <Button variant="outline" title="Cancel ride" onPress={cancel} />}
      {!active && <Button title="Book another ride" onPress={() => setRide(null)} />}
    </ScrollView>;
  }

  return <ScrollView contentContainerStyle={styles.home} keyboardShouldPersistTaps="handled">
    <View style={styles.greeting}>
      <Text style={ui.overline}>{firstName ? `HI, ${firstName.toUpperCase()}` : "CEBU CITY"}</Text>
      <Text style={ui.title}>Where to?</Text>
    </View>
    <View style={styles.map}>
      <View style={styles.mapRoadOne} /><View style={styles.mapRoadTwo} /><View style={styles.mapRoute} />
      <View style={[styles.pin, styles.pinStart]} /><View style={[styles.pin, styles.pinEnd]} />
      <View style={styles.mapBadge}><Text style={styles.mapBadgeText}>{quote && quote.nearby > 0 ? `${quote.nearby} driver${quote.nearby > 1 ? "s" : ""} nearby` : "No drivers nearby"}</Text></View>
    </View>
    <View style={styles.sheet}>
      <View style={styles.inputRow}>
        <View style={styles.dot} />
        <View style={styles.flex}><Text style={styles.inputLabel}>PICKUP</Text><TextInput value={pickup} onChangeText={setPickup} style={styles.input} accessibilityLabel="Pickup" /></View>
        <Ionicons name="navigate-outline" size={18} color={color.muted} />
      </View>
      <View style={styles.inputRow}>
        <View style={[styles.dot, styles.square]} />
        <View style={styles.flex}><Text style={styles.inputLabel}>DROPOFF</Text><TextInput value={dropoff} onChangeText={setDropoff} style={styles.input} accessibilityLabel="Dropoff" /></View>
        <Ionicons name="location-outline" size={19} color={color.muted} />
      </View>
      <View style={styles.choose}>
        <Text style={styles.chooseTitle}>Choose a ride</Text>
        <Text style={ui.hint}>{quote ? `${km(quote.distance_m)} · ${minutes(quote.duration_s)}` : "Loading fares…"}</Text>
      </View>
      {quotes.map((q) => {
        const active = q.tier_id === quote?.tier_id;
        return <Pressable key={q.tier_id} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => setSelected(q.tier_id)} style={[styles.ride, active && styles.rideSelected]}>
          <View style={[styles.car, { backgroundColor: TIER_COLOR[q.tier_id] ?? color.primary }]}><Ionicons name="car-sport" size={22} color="#ffffff" /></View>
          <View style={styles.flex}><Text style={styles.rideName}>{q.name}</Text><Text style={ui.hint}>{q.description} · {q.seats} seats</Text></View>
          <View><Text style={styles.price}>{formatPeso(q.fare)}</Text><Text style={[ui.hint, styles.textRight]}>{q.eta_s == null ? "no drivers" : minutes(q.eta_s)}</Text></View>
        </Pressable>;
      })}
      {error && <Text style={ui.error}>{error}</Text>}
      <Button title={busy ? "Requesting…" : quote ? `Book ${quote.name} · ${formatPeso(quote.fare)}` : "Loading…"} disabled={!quote || busy} onPress={book} style={styles.book} />
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: "center" },
  textCenter: { textAlign: "center" },
  textRight: { textAlign: "right" },
  home: { paddingBottom: 24 },
  greeting: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16, gap: 6 },
  map: { height: 180, overflow: "hidden", backgroundColor: color.map },
  mapRoadOne: { position: "absolute", top: 54, left: -60, width: "140%", height: 18, backgroundColor: color.bg, transform: [{ rotate: "-19deg" }] },
  mapRoadTwo: { position: "absolute", bottom: 34, left: -60, width: "140%", height: 16, backgroundColor: color.bg, transform: [{ rotate: "25deg" }] },
  mapRoute: { position: "absolute", top: 70, left: 73, width: 210, height: 60, borderTopWidth: 8, borderRightWidth: 8, borderColor: color.amber, borderRadius: 42, transform: [{ rotate: "-15deg" }] },
  pin: { position: "absolute", width: 21, height: 21, borderRadius: 12, borderWidth: 3, borderColor: "#ffffff" },
  pinStart: { left: 54, bottom: 66, backgroundColor: color.primary },
  pinEnd: { right: 67, top: 48, backgroundColor: color.danger },
  mapBadge: { position: "absolute", top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: color.primary },
  mapBadgeText: { fontSize: 11, fontWeight: "800", color: "#ffffff" },
  sheet: { marginTop: -12, paddingHorizontal: 20, paddingTop: 16, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: color.card },
  inputRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderColor: color.line },
  dot: { width: 10, height: 10, borderRadius: 6, borderWidth: 2, borderColor: color.primary },
  square: { borderRadius: 1, borderColor: color.amber, backgroundColor: color.amber },
  inputLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: color.muted },
  input: { paddingVertical: 2, fontSize: 15, color: color.text },
  choose: { marginTop: 18, marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chooseTitle: { fontSize: 18, fontWeight: "800", color: color.text },
  ride: { minHeight: 62, padding: 8, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: "transparent", borderRadius: 10 },
  rideSelected: { borderColor: color.primary, backgroundColor: color.primarySoft },
  car: { width: 42, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  rideName: { fontSize: 14, fontWeight: "800", color: color.text },
  price: { fontSize: 14, fontWeight: "800", textAlign: "right", color: color.text },
  book: { marginTop: 14 },
  trip: { flexGrow: 1, justifyContent: "center", gap: 14, padding: 24 },
  tripIcon: { alignSelf: "center", width: 72, height: 72, alignItems: "center", justifyContent: "center", borderRadius: 36, backgroundColor: color.primarySoft },
  driver: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderWidth: 1, borderColor: color.border, borderRadius: 12, backgroundColor: color.card },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: color.amber },
  avatarText: { fontWeight: "800", color: color.text },
  driverName: { fontWeight: "800", color: color.text },
  rating: { fontSize: 13, fontWeight: "800", color: "#bd8212" }
});
