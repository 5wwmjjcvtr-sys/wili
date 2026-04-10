import { StationViewProvider } from './types';
import { ProxyProvider } from './ProxyProvider';
import { SearchResult, StationView } from '@/types/station';
import { loadStops, searchStops, loadRblMapping } from '@/lib/stops-loader';
import { normalizeMonitorResponse } from '@/lib/normalize';
import { isWienerLinienError, WlApiError, WL_CODE_NO_DATA } from '@/lib/wl-error';

const MONITOR_URL = 'https://www.wienerlinien.at/ogd_realtime/monitor';
const proxyFallback = new ProxyProvider();

function emptyStationView(stopId: string): StationView {
  return {
    mode: 'direct',
    updatedAt: new Date().toISOString(),
    station: { stopId, title: '' },
    alerts: [],
    lineGroups: [],
    stationInfrastructure: { hasElevatorIssue: false, elevatorMessages: [] },
  };
}

export class DirectProvider implements StationViewProvider {
  async searchStops(query: string): Promise<SearchResult[]> {
    const stops = await loadStops();
    return searchStops(stops, query);
  }

  async getStationView(stopId: string): Promise<StationView> {
    // ── 1. Versuche direkten API-Aufruf ──────────────────────────────────────
    let directData: unknown = null;
    let useProxy = false;

    try {
      const rblMap = await loadRblMapping();
      const rblNumbers = rblMap.get(stopId);

      if (!rblNumbers || rblNumbers.length === 0) {
        // Keine RBL-Nummern bekannt → sofort zum Proxy
        useProxy = true;
      } else {
        const params = rblNumbers.map(r => `stopId=${encodeURIComponent(r)}`).join('&');
        const url = `${MONITOR_URL}?${params}&activateTrafficInfo=stoerungkurz&activateTrafficInfo=aufzugsinfo`;
        const res = await fetch(url);
        if (!res.ok) {
          // HTTP-Fehler (5xx, 4xx) → Proxy versuchen
          useProxy = true;
        } else {
          directData = await res.json();
        }
      }
    } catch {
      // Netzwerkfehler → Proxy versuchen
      useProxy = true;
    }

    // ── 2. WL-API-Fehlercode auswerten ────────────────────────────────────────
    if (directData !== null && isWienerLinienError(directData)) {
      const { messageCode } = directData.message;

      // 322: keine Daten → leeres Ergebnis, kein Absturz
      if (messageCode === WL_CODE_NO_DATA) return emptyStationView(stopId);

      // Wiederholbare Fehler (311 DB down, 316 Rate-Limit) → Proxy versuchen
      if (new WlApiError(directData.message).retryable) {
        useProxy = true;
        directData = null;
      } else {
        // Nicht wiederholbare Fehler (312 ungültige Stop-ID, 320/321 Client-Fehler)
        // → Proxy hilft nicht, Fehler direkt anzeigen
        throw new WlApiError(directData.message);
      }
    }

    // ── 3. Normalisieren (Direktaufruf hat funktioniert) ──────────────────────
    if (directData !== null) {
      return normalizeMonitorResponse(directData, stopId, 'direct');
    }

    // ── 4. Fallback: Proxy ────────────────────────────────────────────────────
    if (useProxy) {
      return await proxyFallback.getStationView(stopId);
    }

    return emptyStationView(stopId);
  }
}
