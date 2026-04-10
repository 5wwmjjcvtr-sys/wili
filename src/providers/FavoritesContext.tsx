import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Favorite, FavoritesContainer, FavoritesPrefs,
  loadFromStorage, saveToStorage, parseUrlFavorites,
  toReadableUrl, toEncodedUrl, buildDirectionKey, getEffectiveRefreshInterval, getEffectiveTheme,
} from '@/lib/favorites';

interface FavoritesContextValue {
  favorites: Favorite[];
  prefs: FavoritesPrefs;
  isFavorite: (directionKey: string) => boolean;
  toggleFavorite: (fav: Favorite) => void;
  removeFavorite: (directionKey: string) => void;
  moveStation: (stopId: string, direction: 'up' | 'down') => void;
  moveItem: (directionKey: string, direction: 'up' | 'down') => void;
  setDepCount: (n: number) => void;
  setRefreshInterval: (n: number) => void;
  setThemePref: (t: 'light' | 'dark' | 'system') => void;
  setShowFirstDep: (v: boolean) => void;
  setShowLastDep: (v: boolean) => void;
  setShowTime: (v: boolean) => void;
  setShowTimeDiff: (v: boolean) => void;
  setShowCurrentTime: (v: boolean) => void;
  setShowUpdatedAt: (v: boolean) => void;
  refreshInterval: number;
  generateReadableUrl: () => string;
  generateEncodedUrl: () => string;
  hasFavorites: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  cacheStationTitle: (stopId: string, title: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  const [container, setContainer] = useState<FavoritesContainer>(() => {
    // Priority: URL > localStorage
    const urlContainer = parseUrlFavorites(new URL(window.location.href));
    if (urlContainer && urlContainer.favorites.length > 0) return urlContainer;
    return loadFromStorage();
  });

  // Persist to localStorage on change
  useEffect(() => {
    saveToStorage(container);
  }, [container]);

  // Always derive the canonical key from source fields so stale stored directionKey values are ignored.
  const effectiveKey = useCallback((f: Favorite) =>
    buildDirectionKey(f.stopId, f.lineName, f.richtungsId, f.direction),
  []);

  const isFavorite = useCallback((directionKey: string) => {
    return container.favorites.some(f => effectiveKey(f) === directionKey);
  }, [container.favorites, effectiveKey]);

  const toggleFavorite = useCallback((fav: Favorite) => {
    const favKey = buildDirectionKey(fav.stopId, fav.lineName, fav.richtungsId, fav.direction);
    setContainer(prev => {
      const exists = prev.favorites.some(f => effectiveKey(f) === favKey);
      if (exists) {
        return { ...prev, favorites: prev.favorites.filter(f => effectiveKey(f) !== favKey) };
      }
      // Auto-assign order: stationOrder = max existing for this stop or next global, itemOrder = count within stop
      const sameStop = prev.favorites.filter(f => f.stopId === fav.stopId);
      const maxOrder = prev.favorites.length > 0 ? Math.max(...prev.favorites.map(f => f.stationOrder)) : -1;
      const stationOrder = sameStop.length > 0
        ? sameStop[0].stationOrder
        : maxOrder + 1;
      const itemOrder = sameStop.length > 0
        ? Math.max(...sameStop.map(f => f.itemOrder)) + 1
        : 0;
      return { ...prev, favorites: [...prev.favorites, { ...fav, directionKey: favKey, stationOrder, itemOrder }] };
    });
  }, [effectiveKey]);

  const removeFavorite = useCallback((directionKey: string) => {
    setContainer(prev => ({
      ...prev,
      favorites: prev.favorites.filter(f => effectiveKey(f) !== directionKey),
    }));
  }, [effectiveKey]);

  const moveStation = useCallback((stopId: string, direction: 'up' | 'down') => {
    setContainer(prev => {
      // First normalize stationOrder to ensure unique sequential values
      const uniqueStops = [...new Set(prev.favorites.map(f => f.stopId))];
      // Sort by current stationOrder (use first favorite per stop)
      const stopOrders = uniqueStops.map(sid => ({
        stopId: sid,
        order: prev.favorites.find(f => f.stopId === sid)!.stationOrder,
      })).sort((a, b) => a.order - b.order);

      const idx = stopOrders.findIndex(s => s.stopId === stopId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= stopOrders.length) return prev;

      // Assign normalized sequential orders, then swap the two
      const normalizedOrders = stopOrders.map((s, i) => ({ ...s, order: i }));
      const tmpOrder = normalizedOrders[idx].order;
      normalizedOrders[idx].order = normalizedOrders[swapIdx].order;
      normalizedOrders[swapIdx].order = tmpOrder;

      const orderMap = new Map(normalizedOrders.map(s => [s.stopId, s.order]));
      return {
        ...prev,
        favorites: prev.favorites.map(f => ({
          ...f,
          stationOrder: orderMap.get(f.stopId) ?? f.stationOrder,
        })),
      };
    });
  }, []);

  const moveItem = useCallback((directionKey: string, direction: 'up' | 'down') => {
    setContainer(prev => {
      const fav = prev.favorites.find(f => effectiveKey(f) === directionKey);
      if (!fav) return prev;
      const sameStop = prev.favorites
        .filter(f => f.stopId === fav.stopId)
        .sort((a, b) => a.itemOrder - b.itemOrder);
      const idx = sameStop.findIndex(f => effectiveKey(f) === directionKey);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sameStop.length) return prev;

      // Normalize to sequential, then swap
      const normalized = sameStop.map((f, i) => ({ key: effectiveKey(f), order: i }));
      const tmpOrder = normalized[idx].order;
      normalized[idx].order = normalized[swapIdx].order;
      normalized[swapIdx].order = tmpOrder;

      const orderMap = new Map(normalized.map(n => [n.key, n.order]));
      return {
        ...prev,
        favorites: prev.favorites.map(f => {
          const newOrder = orderMap.get(effectiveKey(f));
          return newOrder !== undefined ? { ...f, itemOrder: newOrder } : f;
        }),
      };
    });
  }, [effectiveKey]);
  const setDepCount = useCallback((n: number) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, depCount: n } }));
  }, []);

  const setRefreshInterval = useCallback((n: number) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, refreshInterval: n } }));
  }, []);

  const { setTheme } = useTheme();

  const setThemePref = useCallback((t: 'light' | 'dark' | 'system') => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, theme: t } }));
    setTheme(t);
  }, [setTheme]);

  // Sync theme on mount
  useEffect(() => {
    const theme = getEffectiveTheme(container.prefs);
    setTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setShowFirstDep = useCallback((v: boolean) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, showFirstDep: v } }));
  }, []);

  const setShowLastDep = useCallback((v: boolean) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, showLastDep: v } }));
  }, []);

  const setShowTime = useCallback((v: boolean) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, showTime: v } }));
  }, []);

  const setShowTimeDiff = useCallback((v: boolean) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, showTimeDiff: v } }));
  }, []);

  const setShowCurrentTime = useCallback((v: boolean) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, showCurrentTime: v } }));
  }, []);

  const setShowUpdatedAt = useCallback((v: boolean) => {
    setContainer(prev => ({ ...prev, prefs: { ...prev.prefs, showUpdatedAt: v } }));
  }, []);

  const cacheStationTitle = useCallback((stopId: string, title: string) => {
    if (!title) return;
    setContainer(prev => {
      const needsUpdate = prev.favorites.some(f => f.stopId === stopId && f.stationTitle !== title);
      if (!needsUpdate) return prev;
      return {
        ...prev,
        favorites: prev.favorites.map(f =>
          f.stopId === stopId ? { ...f, stationTitle: title } : f
        ),
      };
    });
  }, []);

  const generateReadableUrl = useCallback(() => {
    const base = window.location.origin + window.location.pathname;
    return toReadableUrl(container, base);
  }, [container]);

  const generateEncodedUrl = useCallback(() => {
    const base = window.location.origin + window.location.pathname;
    return toEncodedUrl(container, base);
  }, [container]);

  const refreshInterval = getEffectiveRefreshInterval(container.prefs);

  return (
    <FavoritesContext.Provider value={{
      favorites: container.favorites,
      prefs: container.prefs,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      moveStation,
      moveItem,
      setDepCount,
      setRefreshInterval,
      setThemePref,
      setShowFirstDep,
      setShowLastDep,
      setShowTime,
      setShowTimeDiff,
      setShowCurrentTime,
      setShowUpdatedAt,
      refreshInterval,
      generateReadableUrl,
      generateEncodedUrl,
      hasFavorites: container.favorites.length > 0,
      editMode,
      setEditMode,
      cacheStationTitle,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be within FavoritesProvider');
  return ctx;
}
