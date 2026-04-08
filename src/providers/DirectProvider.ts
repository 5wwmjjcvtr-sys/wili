import { StationViewProvider } from './types';
import { ProxyProvider } from './ProxyProvider';
import { SearchResult, StationView } from '@/types/station';
import { loadStops, searchStops, loadRblMapping } from '@/lib/stops-loader';
import { normalizeMonitorResponse } from '@/lib/normalize';

const MONITOR_URL = 'https://www.wienerlinien.at/ogd_realtime/monitor';
const proxyFallback = new ProxyProvider();

export class DirectProvider implements StationViewProvider {
  async searchStops(query: string): Promise<SearchResult[]> {
    const stops = await loadStops();
    return searchStops(stops, query);
  }

  async getStationView(stopId: string): Promise<StationView> {
    try {
      const rblMap = await loadRblMapping();
      const rblNumbers = rblMap.get(stopId);

      if (!rblNumbers || rblNumbers.length === 0) {
        return await proxyFallback.getStationView(stopId);
      }

      const params = rblNumbers.map(r => `stopId=${encodeURIComponent(r)}`).join('&');
      const url = `${MONITOR_URL}?${params}&activateTrafficInfo=stoerungkurz&activateTrafficInfo=aufzugsinfo`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Monitor API error: ${res.status}`);
      const data = await res.json();
      return normalizeMonitorResponse(data, stopId, 'direct');
    } catch {
      return await proxyFallback.getStationView(stopId);
    }
  }
}
