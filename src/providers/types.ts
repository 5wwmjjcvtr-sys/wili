import { SearchResult, StationView } from '@/types/station';

export interface StationViewResult {
  view: StationView;
  apiUrl?: string;
}

export interface StationViewProvider {
  searchStops(query: string): Promise<SearchResult[]>;
  getStationView(stopId: string): Promise<StationView>;
}
