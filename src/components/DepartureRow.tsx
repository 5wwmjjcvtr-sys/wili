import { Departure } from '@/types/station';

interface Props {
  departure: Departure;
}

export function DepartureRow({ departure }: Props) {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
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
      <span className="font-mono font-semibold text-foreground min-w-[2.5rem] text-right">
        {departure.countdown <= 0 ? 'jetzt' : `${departure.countdown}'`}
      </span>
      <span className="text-muted-foreground text-xs">{displayTime}</span>
    </div>
  );
}
