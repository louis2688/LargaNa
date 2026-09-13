export type { Database, Tables, Enums } from "./database.types.js";

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

export const formatPeso = (centavos: number) => `₱${Math.round(centavos / 100).toLocaleString("en-PH")}`;
