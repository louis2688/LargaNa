export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          location: unknown
          speed: number | null
          updated_at: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          location: unknown
          speed?: number | null
          updated_at?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          location?: unknown
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          created_at: string
          is_online: boolean
          plate_number: string
          rating: number
          rating_count: number
          status: Database["public"]["Enums"]["driver_status"]
          tier_id: string
          updated_at: string
          user_id: string
          vehicle_color: string
          vehicle_make: string
          vehicle_model: string
        }
        Insert: {
          created_at?: string
          is_online?: boolean
          plate_number: string
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["driver_status"]
          tier_id: string
          updated_at?: string
          user_id: string
          vehicle_color: string
          vehicle_make: string
          vehicle_model: string
        }
        Update: {
          created_at?: string
          is_online?: boolean
          plate_number?: string
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["driver_status"]
          tier_id?: string
          updated_at?: string
          user_id?: string
          vehicle_color?: string
          vehicle_make?: string
          vehicle_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ride_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          ride_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["ride_status"] | null
          id: number
          ride_id: string
          to_status: Database["public"]["Enums"]["ride_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ride_status"] | null
          id?: never
          ride_id: string
          to_status: Database["public"]["Enums"]["ride_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ride_status"] | null
          id?: never
          ride_id?: string
          to_status?: Database["public"]["Enums"]["ride_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ride_events_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          driver_id: string
          expires_at: string
          id: string
          offered_at: string
          responded_at: string | null
          response: Database["public"]["Enums"]["offer_response"]
          ride_id: string
        }
        Insert: {
          driver_id: string
          expires_at: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          response?: Database["public"]["Enums"]["offer_response"]
          ride_id: string
        }
        Update: {
          driver_id?: string
          expires_at?: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          response?: Database["public"]["Enums"]["offer_response"]
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ride_offers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_tiers: {
        Row: {
          active: boolean
          base_fare: number
          description: string
          id: string
          min_fare: number
          name: string
          per_km: number
          per_min: number
          seats: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          base_fare: number
          description: string
          id: string
          min_fare: number
          name: string
          per_km: number
          per_min: number
          seats: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          base_fare?: number
          description?: string
          id?: string
          min_fare?: number
          name?: string
          per_km?: number
          per_min?: number
          seats?: number
          sort_order?: number
        }
        Relationships: []
      }
      rides: {
        Row: {
          accepted_at: string | null
          arrived_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          distance_m: number
          driver_id: string | null
          dropoff: unknown
          dropoff_address: string
          duration_s: number
          final_fare: number | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          pickup: unknown
          pickup_address: string
          quoted_fare: number
          requested_at: string
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          tier_id: string
        }
        Insert: {
          accepted_at?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          distance_m: number
          driver_id?: string | null
          dropoff: unknown
          dropoff_address: string
          duration_s: number
          final_fare?: number | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup: unknown
          pickup_address: string
          quoted_fare: number
          requested_at?: string
          rider_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tier_id: string
        }
        Update: {
          accepted_at?: string | null
          arrived_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          distance_m?: number
          driver_id?: string | null
          dropoff?: unknown
          dropoff_address?: string
          duration_s?: number
          final_fare?: number | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pickup?: unknown
          pickup_address?: string
          quoted_fare?: number
          requested_at?: string
          rider_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rides_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ride_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_ride: {
        Args: { ride_id: string }
        Returns: Database["public"]["Tables"]["rides"]["Row"]
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_driver_status: {
        Args: { driver_id: string; new_status: Database["public"]["Enums"]["driver_status"] }
        Returns: undefined
      }
      advance_ride: {
        Args: {
          ride_id: string
          to_status: Database["public"]["Enums"]["ride_status"]
        }
        Returns: Database["public"]["Tables"]["rides"]["Row"]
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      available_drivers: {
        Args: { near: unknown; radius_m?: number; tier: string }
        Returns: {
          distance_m: number
          driver_id: string
        }[]
      }
      cancel_ride: {
        Args: { reason?: string; ride_id: string }
        Returns: Database["public"]["Tables"]["rides"]["Row"]
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_offer: { Args: { ride_id: string }; Returns: undefined }
      estimate_route: {
        Args: { dropoff: unknown; pickup: unknown }
        Returns: Record<string, unknown>
      }
      expire_stale_requests: { Args: never; Returns: number }
      fare_for: {
        Args: {
          distance_m: number
          duration_s: number
          tier: Database["public"]["Tables"]["ride_tiers"]["Row"]
        }
        Returns: number
      }
      fare_quote: {
        Args: {
          dropoff_lat: number
          dropoff_lng: number
          pickup_lat: number
          pickup_lng: number
        }
        Returns: {
          description: string
          distance_m: number
          duration_s: number
          eta_s: number
          fare: number
          name: string
          nearby: number
          seats: number
          tier_id: string
        }[]
      }
      geo_point: { Args: { lat: number; lng: number }; Returns: unknown }
      is_admin: { Args: never; Returns: boolean }
      rate_ride: {
        Args: { comment?: string; ride_id: string; stars: number }
        Returns: undefined
      }
      request_ride: {
        Args: {
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          tier_id: string
        }
        Returns: Database["public"]["Tables"]["rides"]["Row"]
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_driver_online: { Args: { online: boolean }; Returns: boolean }
      update_driver_location: {
        Args: { heading?: number; lat: number; lng: number; speed?: number }
        Returns: undefined
      }
    }
    Enums: {
      driver_status: "pending" | "approved" | "suspended"
      offer_response: "pending" | "accepted" | "declined" | "expired"
      payment_method: "cash"
      ride_status:
        | "requested"
        | "accepted"
        | "arrived"
        | "in_progress"
        | "completed"
        | "cancelled_by_rider"
        | "cancelled_by_driver"
        | "no_driver"
      user_role: "rider" | "driver" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      driver_status: ["pending", "approved", "suspended"],
      offer_response: ["pending", "accepted", "declined", "expired"],
      payment_method: ["cash"],
      ride_status: [
        "requested",
        "accepted",
        "arrived",
        "in_progress",
        "completed",
        "cancelled_by_rider",
        "cancelled_by_driver",
        "no_driver",
      ],
      user_role: ["rider", "driver", "admin"],
    },
  },
} as const
