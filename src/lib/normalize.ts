import { LineType, LineGroup, Alert, StationView, Direction, Departure } from '@/types/station';

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
  const lineMap = new Map<string, { type: LineType; directions: Map<string, Direction> }>();
  const alertsMap = new Map<string, Alert>();

  for (const monitor of monitors) {
    const stopName = monitor?.locationStop?.properties?.title ?? 
                     monitor?.locationStop?.properties?.name ?? '';
    if (!stationTitle && stopName) stationTitle = stopName;

    for (const line of monitor?.lines ?? []) {
      const lineName: string = line.name ?? '';
      const towards: string = line.towards ?? '';
      const directionId: string = line.direction ?? '';
      const platform: string = line.platform ?? '';
      const barrierFree: boolean = line.barrierFree ?? false;
      const vehicleType: string = line.departures?.departure?.[0]?.vehicle?.type ?? '';
      const lineType = parseLineType(lineName, vehicleType || undefined);

      if (!lineMap.has(lineName)) {
        lineMap.set(lineName, { type: lineType, directions: new Map() });
      }
      const lineEntry = lineMap.get(lineName)!;

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
      const dirEntry = lineEntry.directions.get(dirKey)!;

      for (const dep of line.departures?.departure ?? []) {
        const dt = dep.departureTime ?? {};
        const departure: Departure = {
          countdown: dt.countdown ?? 0,
          timePlanned: dt.timePlanned ?? '',
          timeReal: dt.timeReal || undefined,
          isRealtime: !!dt.timeReal,
          isBarrierFree: dep.vehicle?.barrierFree ?? undefined,
        };
        dirEntry.departures.push(departure);
      }

      // Process traffic info from the line
      for (const trafficInfo of line.trafficjam ? [] : (monitor?.trafficInfos ?? [])) {
        // handled below
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

  // Sort departures within each direction and limit to 3
  for (const [, lineEntry] of lineMap) {
    for (const [, dir] of lineEntry.directions) {
      dir.departures.sort((a, b) => a.countdown - b.countdown);
      dir.departures = dir.departures.slice(0, 10);
    }
  }

  // Build sorted line groups
  const lineGroups: LineGroup[] = Array.from(lineMap.entries())
    .map(([name, entry]) => ({
      type: entry.type,
      name,
      directions: Array.from(entry.directions.values()),
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
  };
}
