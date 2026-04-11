const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MONITOR_URL = 'https://www.wienerlinien.at/ogd_realtime/monitor';
const HALTESTELLEN_CSV = 'https://data.wien.gv.at/csv/wienerlinien-ogd-haltestellen.csv';
const STEIGE_CSV = 'https://data.wien.gv.at/csv/wienerlinien-ogd-steige.csv';

// Cache: DIVA -> RBL numbers
let divaToRbl: Map<string, string[]> | null = null;

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.ok || attempt === attempts || response.status < 500) {
        return response;
      }
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function loadDivaToRbl(): Promise<Map<string, string[]>> {
  if (divaToRbl) return divaToRbl;

  // Load both CSVs in parallel
  const [halteRes, steigeRes] = await Promise.all([
    fetchWithRetry(HALTESTELLEN_CSV),
    fetchWithRetry(STEIGE_CSV),
  ]);
  if (!halteRes.ok) throw new Error(`Haltestellen CSV: ${halteRes.status}`);
  if (!steigeRes.ok) throw new Error(`Steige CSV: ${steigeRes.status}`);

  const [halteText, steigeText] = await Promise.all([halteRes.text(), steigeRes.text()]);

  // Build HALTESTELLEN_ID -> DIVA map
  const haltIdToDiva = new Map<string, string>();
  const halteLines = halteText.split('\n');
  const halteHeader = halteLines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const hIdIdx = halteHeader.findIndex(h => h === 'HALTESTELLEN_ID');
  const divaIdx = halteHeader.findIndex(h => h === 'DIVA');
  for (let i = 1; i < halteLines.length; i++) {
    const cols = halteLines[i].split(';').map(c => c.trim().replace(/"/g, ''));
    const hId = cols[hIdIdx >= 0 ? hIdIdx : 0];
    const diva = cols[divaIdx >= 0 ? divaIdx : 2];
    if (hId && diva) haltIdToDiva.set(hId, diva);
  }

  // Build DIVA -> RBL[] map from steige CSV
  const result = new Map<string, string[]>();
  const steigeLines = steigeText.split('\n');
  const steigeHeader = steigeLines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const fkHaltIdx = steigeHeader.findIndex(h => h === 'FK_HALTESTELLEN_ID');
  const rblIdx = steigeHeader.findIndex(h => h === 'RBL_NUMMER');

  const seenRbl = new Set<string>();
  for (let i = 1; i < steigeLines.length; i++) {
    const cols = steigeLines[i].split(';').map(c => c.trim().replace(/"/g, ''));
    const fkHalt = cols[fkHaltIdx >= 0 ? fkHaltIdx : 2];
    const rbl = cols[rblIdx >= 0 ? rblIdx : 5];
    if (!fkHalt || !rbl) continue;
    const diva = haltIdToDiva.get(fkHalt);
    if (!diva) continue;
    const key = `${diva}_${rbl}`;
    if (seenRbl.has(key)) continue;
    seenRbl.add(key);
    if (!result.has(diva)) result.set(diva, []);
    result.get(diva)!.push(rbl);
  }

  divaToRbl = result;
  return result;
}

function vehicleTypeToLineType(type: string): string {
  if (type === 'ptMetro') return 'metro';
  if (type === 'ptTram' || type === 'ptTramWLB') return 'tram';
  if (type === 'ptBusNight') return 'nightline';
  return 'bus';
}

const LINE_TYPE_ORDER: Record<string, number> = { metro: 0, tram: 1, bus: 2, nightline: 3 };

function parseLineType(name: string, vehicleType?: string): string {
  if (vehicleType) return vehicleTypeToLineType(vehicleType);
  if (/^U\d/.test(name)) return 'metro';
  if (/^N\d/.test(name)) return 'nightline';
  if (/^\d{1,2}[A-Z]?$/.test(name) || /^(D|O|WLB)$/.test(name)) return 'tram';
  return 'bus';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { stopId } = await req.json();
    if (!stopId) {
      return new Response(JSON.stringify({ error: 'stopId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map DIVA to RBL numbers
    const mapping = await loadDivaToRbl();
    const rblNumbers = mapping.get(stopId);
    if (!rblNumbers || rblNumbers.length === 0) {
      return new Response(JSON.stringify({
        mode: 'proxy',
        updatedAt: new Date().toISOString(),
        station: { stopId, title: '' },
        alerts: [],
        lineGroups: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build URL with multiple stopId params (RBL numbers)
    const params = rblNumbers.map(r => `stopId=${encodeURIComponent(r)}`).join('&');
    const url = `${MONITOR_URL}?${params}&activateTrafficInfo=stoerungkurz&activateTrafficInfo=aufzugsinfo`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`Monitor API: ${res.status}`);
    const data = await res.json();

    const monitors = data?.data?.monitors ?? [];
    const serverTime = data?.message?.serverTime ?? new Date().toISOString();
    let stationTitle = '';
    const lineMap = new Map<string, { type: string; directions: Map<string, any> }>();
    const alertsMap = new Map<string, any>();

    for (const monitor of monitors) {
      const name = monitor?.locationStop?.properties?.title ?? monitor?.locationStop?.properties?.name ?? '';
      if (!stationTitle && name) stationTitle = name;

      for (const line of monitor?.lines ?? []) {
        const lineName = line.name ?? '';
        const fallbackTowards = line.towards ?? '';
        const fallbackDirectionId = line.direction ?? '';
        const fallbackPlatform = line.platform ?? '';
        const barrierFree = line.barrierFree ?? false;
        const vType = line.departures?.departure?.[0]?.vehicle?.type ?? '';
        const lineType = parseLineType(lineName, vType || undefined);

        if (!lineMap.has(lineName)) lineMap.set(lineName, { type: lineType, directions: new Map() });
        const entry = lineMap.get(lineName)!;

        for (const dep of line.departures?.departure ?? []) {
          const dt = dep.departureTime ?? {};
          const vehicle = dep.vehicle ?? {};
          const directionId = vehicle.direction ?? fallbackDirectionId;
          const towards = vehicle.towards ?? fallbackTowards;
          const platform = vehicle.platform ?? fallbackPlatform;
          const dirKey = `${directionId}_${towards}`;

          if (!entry.directions.has(dirKey)) {
            entry.directions.set(dirKey, { directionId, towards, platform: platform || undefined, isBarrierFree: barrierFree, departures: [] });
          }

          const dir = entry.directions.get(dirKey)!;
          dir.departures.push({ countdown: dt.countdown ?? 0, timePlanned: dt.timePlanned ?? '', timeReal: dt.timeReal || undefined, isRealtime: !!dt.timeReal, isBarrierFree: vehicle?.barrierFree ?? undefined });
        }
      }

      for (const cat of ['stoerungkurz', 'stoerunglang']) {
        for (const info of monitor?.[cat] ?? []) {
          const key = info.name ?? info.title ?? '';
          if (!alertsMap.has(key)) {
            alertsMap.set(key, { id: String(info.refTrafficInfoCategoryId ?? Math.random()), title: info.title ?? info.name ?? 'Störung', description: info.description ?? '', relatedLines: info.relatedLines ?? [], type: 'local' });
          }
        }
      }
    }

    // Parse elevator infos from trafficInfos
    const elevatorMessages: Array<{ title: string; description: string }> = [];
    for (const monitor of monitors) {
      for (const info of monitor?.trafficInfos ?? []) {
        const infoName = (info?.name ?? '').toLowerCase();
        const infoTitle = (info?.title ?? '').toLowerCase();
        if (
          infoName.includes('aufzug') ||
          infoTitle.includes('aufzug') ||
          String(info?.trafficInfoCategoryId ?? '') === '8'
        ) {
          elevatorMessages.push({
            title: info.title ?? info.name ?? 'Aufzugsstörung',
            description: info.description ?? '',
          });
        }
      }
    }

    for (const [, e] of lineMap) {
      for (const [, d] of e.directions) {
        const seen = new Set<string>();
        d.departures = d.departures.filter((dep: any) => {
          if (seen.has(dep.timePlanned)) return false;
          seen.add(dep.timePlanned);
          return true;
        });
        d.departures.sort((a: any, b: any) => a.countdown - b.countdown);
        d.departures = d.departures.slice(0, 10);
      }
    }

    const lineGroups = Array.from(lineMap.entries())
      .map(([n, e]) => ({ type: e.type, name: n, directions: Array.from(e.directions.values()) }))
      .sort((a, b) => (LINE_TYPE_ORDER[a.type] ?? 9) - (LINE_TYPE_ORDER[b.type] ?? 9) || a.name.localeCompare(b.name, 'de', { numeric: true }));

    const result = {
      mode: 'proxy',
      updatedAt: serverTime,
      station: { stopId, title: stationTitle },
      alerts: Array.from(alertsMap.values()),
      lineGroups,
      stationInfrastructure: {
        hasElevatorIssue: elevatorMessages.length > 0,
        elevatorMessages,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
