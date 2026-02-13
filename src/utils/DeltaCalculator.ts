import { GeoPoint } from '../types/supabase';
import { haversineKm } from './geo';

/**
 * Ein Punkt der Referenz- oder aktuellen Runde.
 * `timeSeconds` ist die verstrichene Zeit seit Rundenstart.
 */
export interface RoutePoint extends GeoPoint {
  timeSeconds: number;
}

export interface DeltaResult {
  deltaSeconds: number;
  isFaster: boolean;
}

/**
 * Berechnet die Zeitdifferenz zwischen einer laufenden Runde und einer
 * gespeicherten Referenz-Runde.
 *
 * Intern wird die Referenz-Route in eine Lookup-Tabelle (kumulative Distanz → Zeit)
 * umgewandelt. Da GPS-Punkte unregelmaessige Abstaende haben, wird bei der Abfrage
 * linear zwischen den beiden naechstgelegenen Stuetzpunkten interpoliert.
 *
 * Beispiel:
 *   Referenz-Punkt A: 100 m → 5.0 s
 *   Referenz-Punkt B: 110 m → 6.0 s
 *   Abfrage bei 105 m → interpoliert zu 5.5 s
 */
export class DeltaCalculator {
  /**
   * Sortierte Stuetzpunkte: [kumulativeDistanzKm, zeitSeconds]
   * Aufsteigend nach Distanz — ermoeglicht binaere Suche.
   */
  private samples: [number, number][] = [];

  /** Gesamtlaenge der Referenz-Route in km. */
  private totalDistanceKm = 0;

  /**
   * Speichert eine Referenz-Runde und baut die Interpolations-Tabelle auf.
   *
   * Punkte mit identischer kumulativer Distanz zum Vorgaenger (z.B. GPS-Jitter
   * am Stand) werden uebersprungen, damit die Tabelle streng monoton steigend bleibt.
   */
  setReferenceRoute(routePoints: RoutePoint[]): void {
    this.samples = [];
    this.totalDistanceKm = 0;

    if (routePoints.length === 0) return;

    // Erster Punkt = Distanz 0
    let cumulativeKm = 0;
    this.samples.push([0, routePoints[0].timeSeconds]);

    for (let i = 1; i < routePoints.length; i++) {
      const segmentKm = haversineKm(routePoints[i - 1], routePoints[i]);

      // GPS-Jitter am Stand ueberspringen (Distanz ~0)
      if (segmentKm < 1e-6) continue;

      cumulativeKm += segmentKm;
      this.samples.push([cumulativeKm, routePoints[i].timeSeconds]);
    }

    this.totalDistanceKm = cumulativeKm;
  }

  /**
   * Ermittelt die Referenz-Zeit bei `currentDistanceKm` per linearer Interpolation
   * und gibt die Differenz zur aktuellen Zeit zurueck.
   *
   * - `deltaSeconds > 0` → aktuell langsamer als Referenz
   * - `deltaSeconds < 0` → aktuell schneller als Referenz
   * - `isFaster` ist `true` wenn aktuell schneller oder gleich
   *
   * Gibt `null` zurueck, wenn keine Referenz gesetzt ist oder die Distanz
   * ausserhalb des Referenz-Bereichs liegt.
   */
  calculateDelta(currentDistanceKm: number, currentTimeSeconds: number): DeltaResult | null {
    if (this.samples.length < 2) return null;
    if (currentDistanceKm < 0) return null;
    if (currentDistanceKm > this.totalDistanceKm) return null;

    const refTime = this.interpolateTime(currentDistanceKm);
    if (refTime === null) return null;

    const deltaSeconds = currentTimeSeconds - refTime;

    return {
      deltaSeconds,
      isFaster: deltaSeconds <= 0,
    };
  }

  /**
   * Binaere Suche + lineare Interpolation.
   *
   * Findet die zwei Stuetzpunkte die `targetKm` einschliessen und
   * interpoliert die Zeit linear zwischen ihnen.
   */
  private interpolateTime(targetKm: number): number | null {
    const n = this.samples.length;
    if (n === 0) return null;

    // Exakte Treffer an den Raendern
    if (targetKm <= this.samples[0][0]) return this.samples[0][1];
    if (targetKm >= this.samples[n - 1][0]) return this.samples[n - 1][1];

    // Binaere Suche: finde den groessten Index i mit samples[i][0] <= targetKm
    let lo = 0;
    let hi = n - 1;

    while (lo < hi - 1) {
      const mid = (lo + hi) >>> 1;
      if (this.samples[mid][0] <= targetKm) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const [distA, timeA] = this.samples[lo];
    const [distB, timeB] = this.samples[hi];
    const segmentLength = distB - distA;

    // Schutz gegen Division durch 0 (sollte durch setReferenceRoute nicht vorkommen)
    if (segmentLength === 0) return timeA;

    const ratio = (targetKm - distA) / segmentLength;
    return timeA + ratio * (timeB - timeA);
  }
}
