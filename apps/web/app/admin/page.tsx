"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { RIDE_STATUS_LABEL, formatPeso, type Tables } from "@largana/core";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { SignInForm } from "../../components/sign-in-form";
import { SiteHeader } from "../../components/site-header";
import { supabase } from "../../lib/supabase";

// Ops console. RLS is the real gate (admins see everything, nobody else does); the role check here only picks the UI.
const loadDrivers = () => supabase.from("driver_profiles").select("*, profiles(full_name, phone)").order("created_at", { ascending: false });
const loadRides = () => supabase.from("rides").select("*, profiles(full_name), driver_profiles(plate_number, profiles(full_name))").order("requested_at", { ascending: false }).limit(50);
const loadTiers = () => supabase.from("ride_tiers").select("*").order("sort_order");
type Driver = NonNullable<Awaited<ReturnType<typeof loadDrivers>>["data"]>[number];
type Ride = NonNullable<Awaited<ReturnType<typeof loadRides>>["data"]>[number];
type Tier = Tables<"ride_tiers">;
type DriverStatus = Tables<"driver_profiles">["status"];

const pesos = (centavos: number) => String(centavos / 100);
const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const STATUS_ACTIONS: Record<DriverStatus, { label: string; to: DriverStatus }[]> = {
  pending: [{ label: "Approve", to: "approved" }, { label: "Reject", to: "suspended" }],
  approved: [{ label: "Suspend", to: "suspended" }],
  suspended: [{ label: "Reinstate", to: "approved" }]
};

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const uid = session?.user.id;
  const isAdmin = role === "admin";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!uid) { setRole(undefined); return; }
    supabase.from("profiles").select("role").eq("id", uid).single().then(({ data }) => setRole(data?.role ?? null));
  }, [uid]);

  const refresh = () => {
    loadDrivers().then(({ data, error }) => { if (error) setError(error.message); else setDrivers(data); });
    loadRides().then(({ data, error }) => { if (error) setError(error.message); else setRides(data); });
    loadTiers().then(({ data }) => setTiers(data ?? []));
  };
  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    const channel = supabase.channel("admin:rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const setStatus = async (driver: Driver, status: DriverStatus) => {
    const { error } = await supabase.rpc("admin_set_driver_status", { driver_id: driver.user_id, new_status: status });
    if (error) setError(error.message); else refresh();
  };
  // Uncontrolled form read on submit: reformatting a controlled number input on every keystroke garbled partial edits.
  const saveTier = async (id: string, form: HTMLFormElement) => {
    const data = new FormData(form);
    const cents = (name: string) => Math.round(Number(data.get(name)) * 100);
    const { error } = await supabase.from("ride_tiers")
      .update({ base_fare: cents("base_fare"), per_km: cents("per_km"), per_min: cents("per_min"), min_fare: cents("min_fare"), active: data.get("active") === "on" })
      .eq("id", id);
    if (error) setError(error.message); else { setError(null); refresh(); }
  };

  const today = new Date().toDateString();
  const todays = rides.filter((r) => new Date(r.requested_at).toDateString() === today);
  const kpis: [string, number][] = [
    ["Rides today", todays.length],
    ["Completed", todays.filter((r) => r.status === "completed").length],
    ["No driver", todays.filter((r) => r.status === "no_driver").length],
    ["Cancelled", todays.filter((r) => r.status.startsWith("cancelled")).length],
    ["Drivers online", drivers.filter((d) => d.is_online).length],
    ["Pending approval", drivers.filter((d) => d.status === "pending").length]
  ];

  return <main className="site-shell">
    <SiteHeader session={session} onSignIn={() => {}} onSignOut={() => supabase.auth.signOut()} />
    <section className="admin-shell">
      {!session ? <Card className="admin-narrow">
        <CardHeader><div><CardTitle>Ops sign in</CardTitle><CardDescription>Driver approvals, live rides and fares.</CardDescription></div></CardHeader>
        <CardContent><SignInForm hint="Demo: admin@largana.demo / largana-demo" /></CardContent>
      </Card>
      : role === undefined ? <p className="form-hint">Loading…</p>
      : !isAdmin ? <Card className="admin-narrow"><CardContent>Admins only.</CardContent></Card>
      : <>
        <div className="kpis">{kpis.map(([label, value]) => <div key={label} className="kpi"><strong>{value}</strong><span>{label}</span></div>)}</div>

        <div className="admin-grid">
          <Card>
            <CardHeader><div><CardTitle>Drivers</CardTitle><CardDescription>Approve new drivers, suspend problem ones.</CardDescription></div><Badge variant="outline">{drivers.length}</Badge></CardHeader>
            <CardContent className="table-wrap">
              <table className="table">
                <thead><tr><th>Driver</th><th>Vehicle</th><th>Status</th><th /></tr></thead>
                <tbody>{drivers.map((d) => <tr key={d.user_id}>
                  <td><strong>{d.profiles?.full_name ?? "—"}</strong><br /><small>{d.profiles?.phone ?? ""} · {Number(d.rating).toFixed(1)} ★ ({d.rating_count})</small></td>
                  <td>{d.vehicle_color} {d.vehicle_make} {d.vehicle_model}<br /><small>{d.plate_number} · {d.tier_id}</small></td>
                  <td><Badge variant={d.status === "approved" ? "secondary" : "outline"}>{d.status}</Badge>{d.is_online && <> <Badge>online</Badge></>}</td>
                  <td className="row-actions">{STATUS_ACTIONS[d.status].map((a) => <Button key={a.to} size="sm" variant={a.to === "approved" ? "default" : "outline"} onClick={() => setStatus(d, a.to)}>{a.label}</Button>)}</td>
                </tr>)}</tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Fares</CardTitle><CardDescription>Pesos. Fare = max(minimum, base + per km + per min), rounded to the peso.</CardDescription></div></CardHeader>
            <CardContent className="tiers">
              {tiers.map((t) => <form key={`${t.id}:${t.base_fare}:${t.per_km}:${t.per_min}:${t.min_fare}:${t.active}`} className="tier-form" onSubmit={(e) => { e.preventDefault(); saveTier(t.id, e.currentTarget); }}>
                <strong className="tier-name">{t.name} <small>{t.seats} seats</small></strong>
                {(["base_fare", "per_km", "per_min", "min_fare"] as const).map((field) => <label key={field}>{field.replace("_", " ")}
                  <Input name={field} type="number" required min={0} max={1000} step={0.01} defaultValue={pesos(t[field])} />
                </label>)}
                <label className="switch"><input type="checkbox" name="active" defaultChecked={t.active} /> active</label>
                <Button type="submit" size="sm">Save</Button>
              </form>)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><div><CardTitle>Rides</CardTitle><CardDescription>Latest 50, live.</CardDescription></div></CardHeader>
          <CardContent className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Rider</th><th>Driver</th><th>Route</th><th>Fare</th><th>Status</th></tr></thead>
              <tbody>{rides.map((r) => <tr key={r.id}>
                <td>{when(r.requested_at)}</td>
                <td>{r.profiles?.full_name ?? "—"}</td>
                <td>{r.driver_profiles ? <>{r.driver_profiles.profiles?.full_name ?? "—"}<br /><small>{r.driver_profiles.plate_number}</small></> : "—"}</td>
                <td>{r.pickup_address}<br /><small>→ {r.dropoff_address} · {(r.distance_m / 1000).toFixed(1)} km</small></td>
                <td>{formatPeso(r.final_fare ?? r.quoted_fare)}</td>
                <td><Badge variant={r.status === "completed" ? "secondary" : "outline"}>{RIDE_STATUS_LABEL[r.status]}</Badge></td>
              </tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        {error && <p className="form-error" role="alert">{error}</p>}
      </>}
    </section>
  </main>;
}
