import { Departure } from '@/types/station';
import { Badge } from '@/components/ui/badge';
import { Accessibility } from 'lucide-react';

interface Props {
  departure: Departure;
  isShortTurn?: boolean;
}

export function DepartureRow({ departure, isShortTurn }: Props) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const displayTime = departure.isRealtime && departure.timeReal
    ? formatTime(departure.timeReal)
    : formatTime(departure.timePlanned);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          departure.isRealtime
            ? 'bg-[hsl(var(--wl-realtime))]'
            : 'bg-[hsl(var(--wl-schedule))]'
        }`}
        title={departure.isRealtime ? 'Echtzeit' : 'Fahrplan'}
      />
      {departure.isBarrierFree && (
        <Accessibility className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Barrierefrei" />
      )}
      <span className="font-mono font-semibold text-foreground min-w-[2.5rem] text-right">
        {departure.countdown <= 0 ? 'jetzt' : `${departure.countdown}'`}
      </span>
      <span className="text-muted-foreground text-xs">{displayTime}</span>
      {isShortTurn && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-600">
          Kurz
        </Badge>
      )}
    </div>
  );
}
