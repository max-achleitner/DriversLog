# DriversLog

Eine React Native App fuer Genussfahrer — Touren aufzeichnen, Highlights entdecken und die eigene Fahrzeugsammlung verwalten.

DriversLog richtet sich an Fahrer, die das **Fahrerlebnis** in den Vordergrund stellen: Serpentinen, Landstrassen, Grand-Tour-Feeling. Keine Rundenzeiten, kein Rennstrecken-Fokus — stattdessen ein ruhiges, edles Touring-Erlebnis mit optionalem Race Mode fuer ambitionierte Fahrer.

## Features

### Tour-Aufzeichnung

- **Live-GPS-Tracking** mit Polyline auf der Karte, Distanz, Dauer und Hoehe
- **Automatische Kurven-Erkennung** — erkennt Kehren, scharfe Kurven und Serpentinen anhand von Heading-Aenderungen und Geschwindigkeit. Erkannte Kurven werden als Cyan-Overlay auf der Karte angezeigt und mit der Route gespeichert
- **Automatische Stop-Erkennung** — erkennt 2-Minuten-Pausen und schlaegt vor, den Ort als Waypoint zu markieren (mit Haptic-Feedback und Push-Notification im Hintergrund)
- **Smart Stops** — Waypoints mit Kategorisierung: Fotopunkt, Essen, Parkplatz, Tankstelle (High Octane), Sound-Tunnel, Driving Highlight. Jeweils mit optionaler Notiz
- **Privacy Zone** — Start und Ende der Route werden automatisch um 500 m gekuerzt, damit der Heimatstandort nicht gespeichert wird

### Race Mode

- **Ghost-Vergleich** — fruehere Routen in der Naehe laden und als Ghost-Polyline auf der Karte anzeigen
- **Delta-Time-Bar** — Echtzeit-Vergleich gegen die Ghost-Route: schneller (gruen) oder langsamer (rot) als beim letzten Mal
- **Eigenes Theme** — dunkles High-Contrast-Design mit Rot-Akzenten, angepasste Tab-Labels und Icons

### Fahrzeug-Garage

- **Fahrzeuge verwalten** — Marke, Modell, Baujahr und Modifikationen erfassen
- **Integrierte Fahrzeugdatenbank** — Audi, BMW, VW mit Modellauswahl (erweiterbar)
- **Aktives Fahrzeug** — vor der Aufnahme auswaehlen, wird beim Speichern automatisch zugewiesen

### Einstellungen

- **Auto-Start / Auto-Stop** — Aufnahme automatisch starten beim Verlassen der Home-Zone und stoppen bei Rueckkehr (Geofencing)
- **Home-Zone** — auf der Karte per Tap oder GPS setzen, Radius von 50 m bis 1 km einstellbar
- **Race Mode Toggle** — mit Sicherheitshinweis fuer den Strasseneinsatz

## Tech-Stack

| Technologie | Zweck |
|---|---|
| [Expo](https://expo.dev) (SDK 54, Managed Workflow) | App-Framework |
| [React Native](https://reactnative.dev) | UI |
| [TypeScript](https://www.typescriptlang.org) (Strict Mode) | Typsicherheit |
| [Expo Router](https://docs.expo.dev/router/introduction/) | File-based Navigation |
| [NativeWind](https://www.nativewind.dev) + Tailwind CSS | Styling |
| [Supabase](https://supabase.com) (PostgreSQL) | Backend, Datenbank, Auth |
| [react-native-maps](https://github.com/react-native-maps/react-native-maps) | Kartenansicht |
| [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) | GPS + Geofencing |
| [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) | Lokale Push-Benachrichtigungen |
| [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) | Haptisches Feedback |

## Projekt-Struktur

```
app/
  _layout.tsx               Root Layout (Provider-Wrapper)
  (tabs)/
    _layout.tsx             Tab-Navigation (theme-aware)
    index.tsx               Home (Placeholder)
    record.tsx              Aufnahme / Cockpit
    routes.tsx              Gespeicherte Touren
    garage.tsx              Fahrzeug-Garage
    profile.tsx             Profil + Settings-Link
  settings/index.tsx        Einstellungen

src/
  contexts/                 App-weite State-Provider
    SettingsContext.tsx        Einstellungen (AsyncStorage)
    RaceModeContext.tsx        Theme-Ableitung (Touring / Race)
  hooks/                    Wiederverwendbare Logik
    useRouteRecording.ts      GPS-Aufnahme + Supabase-Speicherung
    useCurveDetection.ts      Kurven-Erkennung (Heading State Machine)
    useStopDetection.ts       Stop-Erkennung (Geschwindigkeit)
    useGhostSelection.ts      Ghost-Route-Suche (Race Mode)
    useActiveCar.ts           Aktives Fahrzeug (persisted)
    useCars.ts                Fahrzeug-CRUD
    useBackgroundLocation.ts  Geofencing-Lifecycle
    useLocationPermission.ts  Standort-Berechtigung
  features/                 Feature-spezifische UI
    recorder/                 Aufnahme-Komponenten
    race/                     Race-Mode-Komponenten
    cars/                     Garage-Komponenten
  components/               Geteilte UI-Komponenten
    PickerModal.tsx           Durchsuchbarer Listen-Picker
  services/
    geofencing.ts             Background-Geofencing-Task
  utils/
    geo.ts                    Haversine, Heading-Delta, Formatierung
    processRouteData.ts       Privacy-Zone-Maskierung
    DeltaCalculator.ts        Race-Mode Delta-Interpolation
  lib/
    supabase.ts               Supabase-Client
    auth.ts                   Auth (aktuell Mock)
  types/
    supabase.ts               Alle DB-Interfaces
  constants/
    colors.ts                 Farbpalette
    carData.ts                Fahrzeug-Stammdaten

supabase/
  schema.sql                Produktions-Schema + RLS
  setup-dev.sql             Dev-Schema (ohne RLS)
  migrate-smart-stops.sql   Migration: Smart-Stop-Felder
```

## Setup

### Voraussetzungen

- [Node.js](https://nodejs.org) >= 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo`)
- Ein [Supabase](https://supabase.com)-Projekt

### Installation

```bash
# Repository klonen
git clone https://github.com/elefantelefantelefant-bit/DriversLog.git
cd DriversLog

# Abhaengigkeiten installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env bearbeiten und Supabase-URL + Anon-Key eintragen
```

### Datenbank einrichten

```bash
# Fuer Entwicklung (ohne RLS):
# supabase/setup-dev.sql in Supabase SQL Editor ausfuehren

# Fuer Produktion (mit RLS):
# supabase/schema.sql in Supabase SQL Editor ausfuehren

# Smart-Stop-Migration (falls nachtraeglich):
# supabase/migrate-smart-stops.sql ausfuehren
```

### App starten

```bash
npx expo start
```

Dann mit Expo Go auf dem Geraet scannen oder einen Development Build erstellen:

```bash
npx eas build --profile development --platform android
```

## Datenbank-Schema

| Tabelle | Beschreibung |
|---|---|
| `profiles` | Nutzerprofile (erweitert Supabase Auth) |
| `cars` | Fahrzeuge mit Marke, Modell, Baujahr, Modifikationen |
| `routes` | Gespeicherte Touren mit Polyline, Distanz, Dauer, Kurven-Highlights |
| `waypoints` | Punkte entlang einer Route mit Typ, Rating, Medien, Tags |

Alle Tabellen nutzen Row Level Security (RLS) — Nutzer sehen nur eigene Daten, oeffentliche Routen sind fuer alle lesbar.

## Design

Die App folgt einem **Touring & Grand Tour**-Vibe:

- **Touring Theme** — warmes Weiss, tiefes Blau (`#1B3A4B`), British Racing Green (`#2E5A3C`), Leder-Braun (`#8B6F47`)
- **Race Theme** — Schwarz mit Rot-Akzenten (`#E11D48`), High-Contrast fuer schnelle Ablesbarkeit

## Lizenz

Dieses Projekt ist derzeit nicht oeffentlich lizenziert.
