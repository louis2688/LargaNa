import type { Database, Tables } from "./database.types.js";
export type { Database, Tables, Enums } from "./database.types.js";

export type Ride = Tables<"rides">;
export type Quote = Database["public"]["Functions"]["fare_quote"]["Returns"][number];

// Ride status vocabulary shared by both apps. The transitions themselves live in SQL
// (advance_ride / cancel_ride); this is only what the UI needs to render each state.
export const ACTIVE_RIDE_STATUSES = ["requested", "accepted", "arrived", "in_progress"] as const;

export const RIDE_STATUS_LABEL = {
  requested: "Finding your driver",
  accepted: "Driver is on the way",
  arrived: "Driver has arrived",
  in_progress: "On the way",
  completed: "Completed",
  cancelled_by_rider: "Cancelled",
  cancelled_by_driver: "Cancelled by driver",
  no_driver: "No drivers available"
} as const;

export type RideStatus = keyof typeof RIDE_STATUS_LABEL;

export const isActive = (status: RideStatus) => (ACTIVE_RIDE_STATUSES as readonly string[]).includes(status);

// Driver trip steps, in the order advance_ride enforces.
export const DRIVER_NEXT_STEP: Partial<Record<RideStatus, { to: RideStatus; label: string }>> = {
  accepted: { to: "arrived", label: "I've arrived at the pickup" },
  arrived: { to: "in_progress", label: "Start trip" },
  in_progress: { to: "completed", label: "Complete trip" }
};

export const formatPeso = (centavos: number) => `₱${Math.round(centavos / 100).toLocaleString("en-PH")}`;
export const km = (meters: number) => `${(meters / 1000).toFixed(1)} km`;
export const minutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");

// ponytail: fixed Cebu demo route until Places autocomplete lands (needs a Google Maps key); addresses are free text.
export const DEMO_PICKUP = { lat: 10.3111, lng: 123.9186, address: "SM City Cebu, Cebu City" };
export const DEMO_DROPOFF = { lat: 10.33, lng: 123.906, address: "IT Park, Cebu City" };

// What the rider reads on the trip screen for each status.
export function riderTripCopy(ride: Ride, driverName: string) {
  const fare = formatPeso(ride.final_fare ?? ride.quoted_fare);
  return {
    requested: { headline: "Finding your driver…", copy: "We're offering your ride to the nearest drivers." },
    accepted: { headline: `${driverName} is on the way.`, copy: "We'll let you know when they're outside." },
    arrived: { headline: `${driverName} is outside.`, copy: "Look for the plate number below." },
    in_progress: { headline: `On the way to ${ride.dropoff_address}.`, copy: `Fare ${fare}, cash.` },
    completed: { headline: "You've arrived.", copy: `${fare} cash. Thanks for riding with LargaNa.` },
    no_driver: { headline: "No drivers available right now.", copy: "Try again in a moment or pick another ride type." },
    cancelled_by_rider: { headline: "Ride cancelled.", copy: "No charge." },
    cancelled_by_driver: { headline: "Your driver had to cancel.", copy: "No charge. Book again to find another driver." }
  }[ride.status];
}
