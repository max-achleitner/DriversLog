// ============================================================
// DriversLog - Supabase TypeScript Interfaces
// ============================================================

/** Oeffentliches Nutzerprofil (erweitert auth.users) */
export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

/** Fahrzeug eines Nutzers */
export interface Car {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number | null;
  modifications: string | null;
  photo_url: string | null;
  created_at: string;
}

/** Gefahrene Strecke / Tour */
export interface Route {
  id: string;
  user_id: string;
  car_id: string | null;
  title: string;
  description: string | null;
  distance_km: number | null;
  duration_seconds: number | null;
  polyline_json: GeoPoint[] | null;
  is_public: boolean;
  created_at: string;
}

/** Smart-Stop Typen */
export type WaypointType =
  | 'PHOTO_SPOT'
  | 'FOOD'
  | 'PARKING_SAFE'
  | 'FUEL_HIGH_OCTANE'
  | 'SOUND_TUNNEL'
  | 'DRIVING_HIGHLIGHT';

/** Besonderer Ort entlang einer Route */
export interface Waypoint {
  id: string;
  route_id: string;
  lat: number;
  lng: number;
  note: string | null;
  photo_url: string | null;
  type: WaypointType | null;
  rating: number | null;
  media_url: string | null;
  description: string | null;
  tags: string[] | null;
  sort_order: number;
  created_at: string;
}

// ============================================================
// Hilfs-Typen
// ============================================================

/** Einzelner Punkt fuer polyline_json */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Insert-Typen: nur die Pflichtfelder + optionale */
export interface ProfileInsert {
  id: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface CarInsert {
  user_id: string;
  make: string;
  model: string;
  year?: number | null;
  modifications?: string | null;
  photo_url?: string | null;
}

export interface RouteInsert {
  user_id: string;
  car_id?: string | null;
  title: string;
  description?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  polyline_json?: GeoPoint[] | null;
  is_public?: boolean;
}

export interface WaypointInsert {
  route_id: string;
  lat: number;
  lng: number;
  note?: string | null;
  photo_url?: string | null;
  type?: WaypointType | null;
  rating?: number | null;
  media_url?: string | null;
  description?: string | null;
  tags?: string[] | null;
  sort_order?: number;
}

/** Update-Typen: alle Felder optional */
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;
export type CarUpdate = Partial<Omit<Car, 'id' | 'user_id' | 'created_at'>>;
export type RouteUpdate = Partial<Omit<Route, 'id' | 'user_id' | 'created_at'>>;
export type WaypointUpdate = Partial<Omit<Waypoint, 'id' | 'route_id' | 'created_at'>>;

// ============================================================
// Supabase Database-Typen (fuer createClient<Database>)
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      cars: {
        Row: Car;
        Insert: CarInsert;
        Update: CarUpdate;
      };
      routes: {
        Row: Route;
        Insert: RouteInsert;
        Update: RouteUpdate;
      };
      waypoints: {
        Row: Waypoint;
        Insert: WaypointInsert;
        Update: WaypointUpdate;
      };
    };
  };
}
