import { StationViewProvider } from './types';
import { SearchResult, StationView } from '@/types/station';
import { loadStops, searchStops } from '@/lib/stops-loader';
import { normalizeMonitorResponse } from '@/lib/normalize';

const MONITOR_URL = 'https://www.wienerlinien.at/ogd_realtime/monitor';

export class DirectProvider implements StationViewProvider {
  async searchStops(query: string): Promise<SearchResult[]> {
    const stops = await loadStops();
    return searchStops(stops, query);
  }

  async getStationView(stopId: string): Promise<StationView> {
    const url = `${MONITOR_URL}?stopId=${encodeURIComponent(stopId)}&activateTrafficInfo=stoerungkurz`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Monitor API error: ${res.status}`);
    const data = await res.json();
    return normalizeMonitorResponse(data, stopId, 'direct');
  }
}
