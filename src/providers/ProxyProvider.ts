import { StationViewProvider } from './types';
import { SearchResult, StationView } from '@/types/station';
import { supabase } from '@/integrations/supabase/client';
import { mergeShortTurns } from '@/lib/normalize';
import { filterStationViewPhantoms } from '@/lib/departure-filter';

export class ProxyProvider implements StationViewProvider {
  async searchStops(query: string): Promise<SearchResult[]> {
    const { data, error } = await supabase.functions.invoke('stops-search', {
      body: { q: query },
    });
    if (error) throw new Error(`Proxy search error: ${error.message}`);
    return data?.results ?? [];
  }

  async getStationView(stopId: string): Promise<StationView> {
    const { data, error } = await supabase.functions.invoke('station-view', {
      body: { stopId },
    });
    if (error) throw new Error(`Proxy station-view error: ${error.message}`);
    return filterStationViewPhantoms(mergeShortTurns({ ...data, mode: 'proxy' }));
  }
}
