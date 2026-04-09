import { LineType, LineGroup, Alert, StationView, Direction, Departure, ElevatorMessage, StationInfrastructure } from '@/types/station';
import { filterPhantomDepartures, PhantomFilterContext } from './departure-filter';

// ─── Interner Typ (nur während der Normalisierung) ────────────────────────────
// Ergänzt Departure um onStop, das aus der Roh-API gelesen wird und für den
// Phantom-Filter benötigt wird. Wird vor der Rückgabe wieder entfernt.
type BuildDep = Departure & { readonly onStop: boolean };

type BuildDir = Omit<Direction, 'departures'> & { departures: BuildDep[] };
type BuildLineEntry = { type: LineType; directions: Map<string, BuildDir> };

// ─────────────────────────────────────────────────────────────────────────────

export function mergeShortTurns(view: StationView): StationView {
  const lineGroups = view.lineGroups.map((group) => {
    const byDirectionId = new Map<string, Direction[]>();
    for (const dir of group.directions) {
      const list = byDirectionId.get(dir.directionId) ?? [];
      list.push(dir);
      byDirectionId.set(dir.directionId, list);
    }
    const merged: Direction[] = [];
    for (const [, dirs] of byDirectionId) {
      if (dirs.length === 1) { merged.push(dirs[0]); continue; }
      const main = dirs.reduce((a, b) => a.departures.length >= b.departures.length ? a : b);
      const combined: Departure[] = [...main.departures];
      for (const short of dirs) {
        if (short === main) continue;
        for (const dep of short.departures) {
          combined.push({ ...dep, shortTurnTowards: short.towards });
        }
      }
      const seen = new Set<string>();
      const deduped = combined.filter(d => {
        if (seen.has(d.timePlanned)) return false;
        seen.add(d.timePlanned);
        return true;
      });
      deduped.sort((a, b) => a.countdown - b.countdown);
      merged.push({ ...main, departures: deduped.slice(0, 10) });
    }
    return { ...group, directions: merged };
  });
  return { ...view, lineGroups };
}

function vehicleTypeToLineType(type: string): LineType {
  if (type === 'ptMetro') return 'metro';
  if (type === 'ptTram' || type === 'ptTramWLB') return 'tram';
  if (type === 'ptBusNight') return 'nightline';
  return 'bus';
}

const LINE_TYPE_ORDER: Record<LineType, number> = {
  metro: 0,
  tram: 1,
  bus: 2,
  nightline: 3,
};

function parseLineType(lineName: string, vehicleType?: string): LineType {
  if (vehicleType) return vehicleTypeToLineType(vehicleType);
  if (/^U\d/.test(lineName)) return 'metro';
  if (/^N\d/.test(lineName)) return 'nightline';
  if (/^\d{1,2}[A-Z]?$/.test(lineName) || /^(D|O|WLB)$/.test(lineName)) return 'tram';
  return 'bus';
}

export function normalizeMonitorResponse(
  data: any,
  stopId: string,
  mode: 'direct' | 'proxy'
): StationView {
  const monitors = data?.data?.monitors ?? [];
  const serverTime = data?.message?.serverTime ?? new Date().toISOString();

  let stationTitle = '';
  const lineMap = new Map<string, BuildLineEntry>();
  const alertsMap = new Map<string, Alert>();

  for (const monitor of monitors) {
    const stopName = monitor?.locationStop?.properties?.title ??
                     monitor?.locationStop?.properties?.name ?? '';
    if (!stationTitle && stopName) stationTitle = stopName;

    for (const line of monitor?.lines ?? []) {
      const lineName: string = line.name ?? '';
      const fallbackTowards: string = line.towards ?? '';
      const fallbackDirectionId: string = line.direction ?? '';
      const fallbackPlatform: string = line.platform ?? '';
      const barrierFree: boolean = line.barrierFree ?? false;
      const vehicleType: string = line.departures?.departure?.[0]?.vehicle?.type ?? '';
      const lineType = parseLineType(lineName, vehicleType || undefined);

      if (!lineMap.has(lineName)) {
        lineMap.set(lineName, { type: lineType, directions: new Map() });
      }
      const lineEntry = lineMap.get(lineName)!;

      for (const dep of line.departures?.departure ?? []) {
        const dt = dep.departureTime ?? {};
        const vehicle = dep.vehicle ?? {};
        const directionId: string = vehicle.direction ?? fallbackDirectionId;
        const towards: string = vehicle.towards ?? fallbackTowards;
        const platform: string = vehicle.platform ?? fallbackPlatform;
        const dirKey = `${directionId}_${towards}`;

        if (!lineEntry.directions.has(dirKey)) {
          lineEntry.directions.set(dirKey, {
            directionId,
            towards,
            platform: platform || undefined,
            isBarrierFree: barrierFree,
            departures: [],
          });
        }

        const countdown: number = dt.countdown ?? 0;
        // onStop: explizites API-Feld, falls vorhanden; sonst aus countdown ≤ 0 ableiten
        const onStop: boolean = !!(dt.onStop ?? (countdown <= 0));

        const buildDep: BuildDep = {
          countdown,
          timePlanned: dt.timePlanned ?? '',
          timeReal: dt.timeReal || undefined,
          isRealtime: !!dt.timeReal,
          isBarrierFree: vehicle.barrierFree ?? undefined,
          onStop,
        };
        lineEntry.directions.get(dirKey)!.departures.push(buildDep);
      }
    }

    // Process traffic infos at monitor level
    for (const category of ['stopiNfo', 'stoerungkurz', 'stoerunglang'] as const) {
      for (const info of monitor?.[category] ?? []) {
        if (!alertsMap.has(info.name ?? info.title ?? '')) {
          alertsMap.set(info.name ?? info.title ?? '', {
            id: String(info.refTrafficInfoCategoryId ?? Math.random()),
            title: info.title ?? info.name ?? 'Störung',
            description: info.description ?? '',
            relatedLines: info.relatedLines ?? [],
            type: 'local',
          });
        }
      }
    }
  }

  // Parse elevator infos from trafficInfos
  const elevatorMessages: ElevatorMessage[] = [];
  for (const monitor of monitors) {
    for (const info of monitor?.trafficInfos ?? []) {
      const name = info?.name ?? '';
      const title = info?.title ?? '';
      if (
        name.toLowerCase().includes('aufzug') ||
        title.toLowerCase().includes('aufzug') ||
        (info?.trafficInfoCategoryId !== undefined && String(info.trafficInfoCategoryId) === '8')
      ) {
        elevatorMessages.push({
          title: info.title ?? info.name ?? 'Aufzugsstörung',
          description: info.description ?? '',
        });
      }
    }
  }

  const stationInfrastructure: StationInfrastructure = {
    hasElevatorIssue: elevatorMessages.length > 0,
    elevatorMessages,
  };

  // Merge short-turn directions into their main direction (same directionId, different towards)
  for (const [, lineEntry] of lineMap) {
    const byDirectionId = new Map<string, string[]>();
    for (const [dirKey, dir] of lineEntry.directions) {
      const keys = byDirectionId.get(dir.directionId) ?? [];
      keys.push(dirKey);
      byDirectionId.set(dir.directionId, keys);
    }
    for (const [, dirKeys] of byDirectionId) {
      if (dirKeys.length <= 1) continue;
      // Main direction = most departures
      let mainKey = dirKeys[0];
      for (const key of dirKeys.slice(1)) {
        if ((lineEntry.directions.get(key)?.departures.length ?? 0) > (lineEntry.directions.get(mainKey)?.departures.length ?? 0)) {
          mainKey = key;
        }
      }
      const mainDir = lineEntry.directions.get(mainKey)!;
      for (const key of dirKeys) {
        if (key === mainKey) continue;
        const shortDir = lineEntry.directions.get(key)!;
        for (const dep of shortDir.departures) {
          // Spread preserves onStop; shortTurnTowards marks the short-turn destination
          mainDir.departures.push({ ...dep, shortTurnTowards: shortDir.towards });
        }
        lineEntry.directions.delete(key);
      }
    }
  }

  // Deduplicate, phantom-filter, sort and limit departures per direction
  for (const [lineName, lineEntry] of lineMap) {
    for (const [, dir] of lineEntry.directions) {
      // 1. Deduplizieren nach timePlanned
      const seen = new Set<string>();
      dir.departures = dir.departures.filter(d => {
        const key = d.timePlanned;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // 2. Phantom-Abfahrten herausfiltern
      const ctx: PhantomFilterContext = {
        stationTitle,
        lineName,
        towards: dir.towards,
        platform: dir.platform ?? '',
      };
      dir.departures = filterPhantomDepartures(dir.departures, lineEntry.type, serverTime, ctx);

      // 3. Sortieren und auf 10 begrenzen
      dir.departures.sort((a, b) => a.countdown - b.countdown);
      dir.departures = dir.departures.slice(0, 10);
    }
  }

  // Build sorted line groups; strip internal onStop field from departures
  const lineGroups: LineGroup[] = Array.from(lineMap.entries())
    .map(([name, entry]) => ({
      type: entry.type,
      name,
      directions: Array.from(entry.directions.values()).map(dir => ({
        directionId: dir.directionId,
        towards: dir.towards,
        platform: dir.platform,
        isBarrierFree: dir.isBarrierFree,
        scheduleBounds: dir.scheduleBounds,
        departures: dir.departures.map(({ onStop: _onStop, ...d }) => d),
      })),
    }))
    .sort((a, b) => {
      const typeOrder = LINE_TYPE_ORDER[a.type] - LINE_TYPE_ORDER[b.type];
      if (typeOrder !== 0) return typeOrder;
      return a.name.localeCompare(b.name, 'de', { numeric: true });
    });

  return {
    mode,
    updatedAt: serverTime,
    station: { stopId, title: stationTitle },
    alerts: Array.from(alertsMap.values()),
    lineGroups,
    stationInfrastructure,
  };
}
