import { StationViewProvider } from './types';
import { SearchResult, StationView } from '@/types/station';
import { supabase } from '@/integrations/supabase/client';
import { mergeShortTurns } from '@/lib/normalize';
import { filterStationViewPhantoms } from '@/lib/departure-filter';
import { isWienerLinienError, WlApiError, WL_CODE_NO_DATA } from '@/lib/wl-error';

function emptyStationView(stopId: string): StationView {
  return {
    mode: 'proxy',
    updatedAt: new Date().toISOString(),
    station: { stopId, title: '' },
    alerts: [],
    lineGroups: [],
    stationInfrastructure: { hasElevatorIssue: false, elevatorMessages: [] },
  };
}

export class ProxyProvider implements StationViewProvider {
  async searchStops(query: string): Promise<SearchResult[]> {
    const { data, error } = await supabase.functions.invoke('stops-search', {
      body: { q: query },
    });
    if (error) throw new Error(`Suche nicht verfügbar: ${error.message}`);
    return data?.results ?? [];
  }

  async getStationView(stopId: string): Promise<StationView> {
    const { data, error } = await supabase.functions.invoke('station-view', {
      body: { stopId },
    });

    if (error) throw new Error('Verbindung zum Server nicht möglich.');

    // Die Edge Function kann WL-API-Fehlercodes durchreichen
    if (isWienerLinienError(data)) {
      if (data.message.messageCode === WL_CODE_NO_DATA) return emptyStationView(stopId);
      throw new WlApiError(data.message);
    }

    if (!data) throw new Error('Keine Daten vom Server erhalten.');

    return filterStationViewPhantoms(mergeShortTurns({ ...data, mode: 'proxy' }));
  }
}
