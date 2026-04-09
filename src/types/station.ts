export type LineType = 'metro' | 'tram' | 'bus' | 'nightline';

export interface SearchResult {
  stopId: string;
  name: string;
}

export interface Departure {
  countdown: number;
  timePlanned: string;
  timeReal?: string;
  isRealtime: boolean;
  isBarrierFree?: boolean;
  shortTurnTowards?: string;
}

export interface ScheduleBounds {
  firstDeparturePlanned: string; // "HH:MM"
  lastDeparturePlanned: string;  // "HH:MM"
}

export interface Direction {
  directionId: string;
  towards: string;
  platform?: string;
  isBarrierFree: boolean;
  departures: Departure[];
  scheduleBounds?: ScheduleBounds;
}

export interface LineGroup {
  type: LineType;
  name: string;
  directions: Direction[];
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  relatedLines: string[];
  type: 'local' | 'network';
}

export interface ElevatorMessage {
  title: string;
  description: string;
}

export interface StationInfrastructure {
  hasElevatorIssue: boolean;
  elevatorMessages: ElevatorMessage[];
}

export interface StationView {
  mode: 'direct' | 'proxy';
  updatedAt: string;
  station: {
    stopId: string;
    title: string;
  };
  alerts: Alert[];
  lineGroups: LineGroup[];
  stationInfrastructure?: StationInfrastructure;
}
