import type { LineType, StationView } from '@/types/station';

// ─── Konfiguration (zentral anpassbar) ───────────────────────────────────────

export const PHANTOM_FILTER_CONFIG = {
  metro: {
    /** Harte Obergrenze: Abfahrt ausblenden wenn timePlanned älter als X Minuten */
    hardLimitMinutes: 12,
    /** Sofort-Limit: bei „jetzt gerade"-Abfahrten strengerer Schwellwert */
    immediateLimitMinutes: 5,
  },
  surface: {
    // Bus, Straßenbahn, Nightline
    hardLimitMinutes: 25,
    immediateLimitMinutes: 10,
  },
  /**
   * countdown <= diesem Wert gilt als „jetzt gerade" (Regel D).
   * Ergänzend greift onStop === true.
   */
  immediateCountdownThreshold: 1,
} as const;

// ─── Typen ────────────────────────────────────────────────────────────────────

export type FilterReason =
  | 'planned_too_old_metro'
  | 'planned_too_old_surface'
  | 'immediate_departure_with_old_planned_time'
  | 'superseded_by_next_plausible_departure';

/** Minimales Interface, das der Filter benötigt. */
export interface FilterableDeparture {
  countdown: number;
  timePlanned: string;
  timeReal?: string;
  onStop: boolean;
}

export interface PhantomFilterContext {
  stationTitle: string;
  lineName: string;
  towards: string;
  platform: string;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Wie viele Minuten liegt timePlanned vor serverTime? Negatives Ergebnis → 0. */
function getPlannedAgeMinutes(timePlanned: string, serverTime: string): number {
  if (!timePlanned || !serverTime) return 0;
  const diffMs = new Date(serverTime).getTime() - new Date(timePlanned).getTime();
  return diffMs > 0 ? diffMs / 60_000 : 0;
}

/** Gilt die Abfahrt als „jetzt gerade"? */
function isImmediate(countdown: number, onStop: boolean): boolean {
  return countdown <= PHANTOM_FILTER_CONFIG.immediateCountdownThreshold || onStop;
}

function logFiltered(
  reason: FilterReason,
  dep: FilterableDeparture,
  ctx: PhantomFilterContext,
  lineType: LineType,
  serverTime: string,
): void {
  console.debug('[PhantomFilter]', reason, {
    station: ctx.stationTitle,
    line: ctx.lineName,
    towards: ctx.towards,
    platform: ctx.platform,
    type: lineType,
    serverTime,
    timePlanned: dep.timePlanned,
    timeReal: dep.timeReal ?? null,
    countdown: dep.countdown,
    onStop: dep.onStop,
  });
}

// ─── Kernfilter ───────────────────────────────────────────────────────────────

/**
 * Filtert Phantom-Abfahrten aus einer Richtungsgruppe.
 *
 * Regelpriorität (laut Spezifikation I):
 *   1. Sofort-Filter „jetzt gerade" mit alter timePlanned  (Regel D)
 *   2. Harte Obergrenze je Verkehrsmittel                  (Regel C)
 *   3. Verdächtig + plausible Folgefahrt vorhanden         (Regel E → ändert Log-Grund)
 *
 * Generisch über T, damit der Aufrufer reichere Objekte (z. B. mit internen
 * Feldern wie shortTurnTowards) übergeben kann – nur FilterableDeparture-
 * Felder werden geprüft.
 */
export function filterPhantomDepartures<T extends FilterableDeparture>(
  departures: T[],
  lineType: LineType,
  serverTime: string,
  ctx: PhantomFilterContext,
): T[] {
  const isMetro = lineType === 'metro';
  const limits = isMetro ? PHANTOM_FILTER_CONFIG.metro : PHANTOM_FILTER_CONFIG.surface;

  // Schritt 1: Jeden Eintrag mit seinem Filter-Grund markieren (null = behalten)
  const tagged = departures.map((dep) => {
    const age = getPlannedAgeMinutes(dep.timePlanned, serverTime);
    const immediate = isImmediate(dep.countdown, dep.onStop);
    let reason: FilterReason | null = null;

    // Regel D hat Vorrang (strenger für „jetzt gerade"-Fälle)
    if (immediate && age > limits.immediateLimitMinutes) {
      reason = 'immediate_departure_with_old_planned_time';
    } else if (age > limits.hardLimitMinutes) {
      // Regel C
      reason = isMetro ? 'planned_too_old_metro' : 'planned_too_old_surface';
    }

    return { dep, reason };
  });

  // Schritt 2: Regel E – gibt es nach einem verdächtigen Eintrag noch eine
  // plausible Fahrt derselben Gruppe? Dann ist der verdächtige „überholt".
  const hasPlausibleSuccessor = (fromIndex: number): boolean =>
    tagged.slice(fromIndex + 1).some(({ reason }) => reason === null);

  // Schritt 3: Ergebnisliste aufbauen
  const result: T[] = [];
  for (let i = 0; i < tagged.length; i++) {
    const { dep, reason } = tagged[i];
    if (reason === null) {
      result.push(dep);
    } else {
      const finalReason: FilterReason = hasPlausibleSuccessor(i)
        ? 'superseded_by_next_plausible_departure'
        : reason;
      logFiltered(finalReason, dep, ctx, lineType, serverTime);
      // Eintrag wird verworfen (nicht in result)
    }
  }

  return result;
}

/**
 * Wendet den Phantom-Filter auf eine bereits normalisierte StationView an.
 * Wird im ProxyProvider-Pfad (Supabase) verwendet, wo normalizeMonitorResponse
 * nicht durchläuft. onStop wird aus countdown ≤ 0 abgeleitet.
 */
export function filterStationViewPhantoms(view: StationView): StationView {
  return {
    ...view,
    lineGroups: view.lineGroups.map(group => ({
      ...group,
      directions: group.directions.map(dir => {
        const depsWithOnStop = dir.departures.map(dep => ({
          ...dep,
          onStop: dep.countdown <= 0,
        }));
        const ctx: PhantomFilterContext = {
          stationTitle: view.station.title,
          lineName: group.name,
          towards: dir.towards,
          platform: dir.platform ?? '',
        };
        const filtered = filterPhantomDepartures(depsWithOnStop, group.type, view.updatedAt, ctx);
        return {
          ...dir,
          departures: filtered.map(({ onStop: _onStop, ...d }) => d),
        };
      }),
    })),
  };
}
