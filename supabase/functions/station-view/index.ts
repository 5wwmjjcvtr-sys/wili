import { corsHeaders } from '@supabase/supabase-js/cors'

const MONITOR_URL = 'https://www.wienerlinien.at/ogd_realtime/monitor';

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

    const url = `${MONITOR_URL}?stopId=${encodeURIComponent(stopId)}&activateTrafficInfo=stoerungkurz`;
    const res = await fetch(url);
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
        const towards = line.towards ?? '';
        const directionId = line.direction ?? '';
        const platform = line.platform ?? '';
        const barrierFree = line.barrierFree ?? false;
        const vType = line.departures?.departure?.[0]?.vehicle?.type ?? '';
        const lineType = parseLineType(lineName, vType || undefined);

        if (!lineMap.has(lineName)) lineMap.set(lineName, { type: lineType, directions: new Map() });
        const entry = lineMap.get(lineName)!;
        const dirKey = `${directionId}_${towards}`;
        if (!entry.directions.has(dirKey)) {
          entry.directions.set(dirKey, { directionId, towards, platform: platform || undefined, isBarrierFree: barrierFree, departures: [] });
        }
        const dir = entry.directions.get(dirKey)!;
        for (const dep of line.departures?.departure ?? []) {
          const dt = dep.departureTime ?? {};
          dir.departures.push({ countdown: dt.countdown ?? 0, timePlanned: dt.timePlanned ?? '', timeReal: dt.timeReal || undefined, isRealtime: !!dt.timeReal });
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

    for (const [, e] of lineMap) {
      for (const [, d] of e.directions) {
        d.departures.sort((a: any, b: any) => a.countdown - b.countdown);
        d.departures = d.departures.slice(0, 3);
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
