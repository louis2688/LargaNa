// End-to-end check of the ride loop against a real Supabase project (run: pnpm --filter @largana/core test).
// Needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Creates two throwaway users and removes them.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/database.types.ts";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
assert.ok(url && anonKey && serviceKey, "set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
const userClient = () => createClient<Database>(url, anonKey, { auth: { persistSession: false } });
const stamp = Date.now();
const password = "test-password-1234";
const SM_CEBU = { lat: 10.3111, lng: 123.9186 };
const IT_PARK = { lat: 10.33, lng: 123.906 };

const ok = <T>(r: { data: T; error: { message: string } | null }, what: string) => {
  assert.equal(r.error, null, `${what}: ${r.error?.message}`);
  return r.data as NonNullable<T>;
};
const fails = async (p: Promise<{ error: { message: string } | null }>, what: string, includes: string) => {
  const { error } = await p;
  assert.ok(error && error.message.includes(includes), `${what} should fail with "${includes}", got: ${error?.message}`);
};

const createUser = async (role: "rider" | "driver", name: string) =>
  ok(await admin.auth.admin.createUser({
    email: `${role}-${stamp}@test.largana.local`, password, email_confirm: true,
    user_metadata: { role, full_name: name }
  }), `create ${role}`).user;

const rider = await createUser("rider", "Test Rider");
const driver = await createUser("driver", "Juan Dela Cruz");
const driver2 = await createUser("driver", "Second Driver");

try {
  // Ops approves the drivers (admin console does this in Phase 2).
  for (const d of [driver, driver2]) {
    ok(await admin.from("driver_profiles").insert({
      user_id: d.id, status: "approved", tier_id: "go",
      vehicle_make: "Toyota", vehicle_model: "Vios", vehicle_color: "Silver", plate_number: "ABC 1234"
    }), "approve driver");
  }

  const riderClient = userClient();
  ok(await riderClient.auth.signInWithPassword({ email: rider.email!, password }), "rider sign in");
  const driverClient = userClient();
  ok(await driverClient.auth.signInWithPassword({ email: driver.email!, password }), "driver sign in");
  const driver2Client = userClient();
  ok(await driver2Client.auth.signInWithPassword({ email: driver2.email!, password }), "driver2 sign in");

  // No drivers online yet: a request gets no_driver immediately.
  const quoteEmpty = ok(await riderClient.rpc("fare_quote", { pickup_lat: SM_CEBU.lat, pickup_lng: SM_CEBU.lng, dropoff_lat: IT_PARK.lat, dropoff_lng: IT_PARK.lng }), "quote");
  assert.equal(quoteEmpty.length, 3, "three tiers quoted");
  assert.equal(quoteEmpty[0].nearby, 0, "nobody nearby");
  const dead = ok(await riderClient.rpc("request_ride", { tier_id: "go", pickup_lat: SM_CEBU.lat, pickup_lng: SM_CEBU.lng, pickup_address: "SM City Cebu", dropoff_lat: IT_PARK.lat, dropoff_lng: IT_PARK.lng, dropoff_address: "IT Park" }), "request with no drivers");
  assert.equal(dead.status, "no_driver");

  // Both drivers go online near the pickup (driver2 a little further away).
  for (const [c, lng] of [[driverClient, SM_CEBU.lng], [driver2Client, SM_CEBU.lng + 0.005]] as const) {
    assert.equal(ok(await c.rpc("set_driver_online", { online: true }), "go online"), true);
    ok(await c.rpc("update_driver_location", { lat: SM_CEBU.lat, lng }), "publish location");
  }

  const quote = ok(await riderClient.rpc("fare_quote", { pickup_lat: SM_CEBU.lat, pickup_lng: SM_CEBU.lng, dropoff_lat: IT_PARK.lat, dropoff_lng: IT_PARK.lng }), "quote");
  const go = quote.find((q) => q.tier_id === "go")!;
  assert.equal(go.nearby, 2, "two go drivers nearby");
  assert.ok(go.fare >= 6000 && go.fare % 100 === 0, `go fare is whole pesos above the minimum, got ${go.fare}`);
  assert.ok(go.eta_s! > 0, "eta computed from nearest driver");
  console.log(`quote: ${go.distance_m} m, ${go.duration_s} s, go=₱${go.fare / 100}, eta ${go.eta_s}s`);

  const ride = ok(await riderClient.rpc("request_ride", { tier_id: "go", pickup_lat: SM_CEBU.lat, pickup_lng: SM_CEBU.lng, pickup_address: "SM City Cebu", dropoff_lat: IT_PARK.lat, dropoff_lng: IT_PARK.lng, dropoff_address: "IT Park" }), "request ride");
  assert.equal(ride.status, "requested");
  assert.equal(ride.quoted_fare, go.fare, "ride carries the quoted fare");
  await fails(riderClient.rpc("request_ride", { tier_id: "go", pickup_lat: SM_CEBU.lat, pickup_lng: SM_CEBU.lng, pickup_address: "x", dropoff_lat: IT_PARK.lat, dropoff_lng: IT_PARK.lng, dropoff_address: "y" }), "second concurrent request", "active ride");

  // Both drivers were offered; the first to accept wins, the second is told so.
  const offers = ok(await driverClient.from("ride_offers").select("*").eq("ride_id", ride.id), "driver sees offer");
  assert.equal(offers.length, 1);
  assert.equal(offers[0].response, "pending");
  const accepted = ok(await driverClient.rpc("accept_ride", { ride_id: ride.id }), "accept");
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.driver_id, driver.id);
  await fails(driver2Client.rpc("accept_ride", { ride_id: ride.id }), "late accept", "no pending offer");

  // Rider can now see the ride, the driver's plate and live location; nothing more.
  const seen = ok(await riderClient.from("rides").select("status, driver_id").eq("id", ride.id).single(), "rider reads ride");
  assert.equal(seen.status, "accepted");
  const plate = ok(await riderClient.from("driver_profiles").select("plate_number").eq("user_id", driver.id).single(), "rider reads driver plate");
  assert.equal(plate.plate_number, "ABC 1234");
  const loc = ok(await riderClient.from("driver_locations").select("driver_id").eq("driver_id", driver.id), "rider reads driver location");
  assert.equal(loc.length, 1);
  const other = ok(await riderClient.from("driver_locations").select("driver_id").eq("driver_id", driver2.id), "rider cannot read other drivers");
  assert.equal(other.length, 0);
  await fails(riderClient.from("rides").update({ quoted_fare: 1 }).eq("id", ride.id).select().single(), "rider edits fare", "permission denied");

  // Trip transitions, driver side, in order only.
  await fails(driverClient.rpc("advance_ride", { ride_id: ride.id, to_status: "in_progress" }), "skip arrived", "not arrived");
  ok(await driverClient.rpc("advance_ride", { ride_id: ride.id, to_status: "arrived" }), "arrived");
  ok(await driverClient.rpc("advance_ride", { ride_id: ride.id, to_status: "in_progress" }), "start");
  const done = ok(await driverClient.rpc("advance_ride", { ride_id: ride.id, to_status: "completed" }), "complete");
  assert.equal(done.status, "completed");
  assert.equal(done.final_fare, ride.quoted_fare, "upfront fare is final");

  const events = ok(await riderClient.from("ride_events").select("to_status").eq("ride_id", ride.id).order("id"), "events");
  assert.deepEqual(events.map((e) => e.to_status), ["requested", "accepted", "arrived", "in_progress", "completed"]);

  ok(await riderClient.rpc("rate_ride", { ride_id: ride.id, stars: 5 }), "rate driver");
  const dp = ok(await admin.from("driver_profiles").select("rating, rating_count").eq("user_id", driver.id).single(), "driver rating");
  assert.equal(dp.rating_count, 1);
  assert.equal(Number(dp.rating), 5);

  console.log("ride flow OK");
} finally {
  await admin.from("rides").delete().eq("rider_id", rider.id);
  for (const u of [rider, driver, driver2]) await admin.auth.admin.deleteUser(u.id);
}
