import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { SearchResult } from '@/types/station';
import { useDataProvider } from '@/providers/ProviderContext';
import { Search, X } from 'lucide-react';

interface Props {
  onSelect: (stop: SearchResult) => void;
  selectedStation?: string;
}

export function StationSearch({ onSelect, selectedStation }: Props) {
  const { provider } = useDataProvider();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await provider.searchStops(q);
      setResults(res);
      setIsOpen(res.length > 0);
    } catch (e: any) {
      setError('Suche fehlgeschlagen');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleSelect = (stop: SearchResult) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onSelect(stop);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative px-4 py-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selectedStation || 'Station suchen...'}
          className="pl-10 pr-10 h-12 text-base"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive mt-1 px-1">{error}</p>
      )}

      {isOpen && (
        <ul className="absolute left-4 right-4 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {results.map((stop) => (
            <li key={stop.stopId}>
              <button
                onClick={() => handleSelect(stop)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-accent focus:bg-accent transition-colors border-b border-border last:border-0"
              >
                {stop.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && query.length >= 2 && (
        <p className="text-xs text-muted-foreground mt-1 px-1">Suche...</p>
      )}
    </div>
  );
}
