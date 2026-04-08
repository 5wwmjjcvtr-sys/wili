import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  Favorite, FavoritesContainer, FavoritesPrefs,
  loadFromStorage, saveToStorage, parseUrlFavorites,
  toReadableUrl, toEncodedUrl, buildDirectionKey,
} from '@/lib/favorites';

interface FavoritesContextValue {
  favorites: Favorite[];
  prefs: FavoritesPrefs;
  isFavorite: (directionKey: string) => boolean;
  toggleFavorite: (fav: Favorite) => void;
  removeFavorite: (directionKey: string) => void;
  moveStation: (stopId: string, direction: 'up' | 'down') => void;
  moveItem: (directionKey: string, direction: 'up' | 'down') => void;
  generateReadableUrl: () => string;
  generateEncodedUrl: () => string;
  hasFavorites: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
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

  const isFavorite = useCallback((directionKey: string) => {
    return container.favorites.some(f => f.directionKey === directionKey);
  }, [container.favorites]);

  const toggleFavorite = useCallback((fav: Favorite) => {
    setContainer(prev => {
      const exists = prev.favorites.some(f => f.directionKey === fav.directionKey);
      if (exists) {
        return { ...prev, favorites: prev.favorites.filter(f => f.directionKey !== fav.directionKey) };
      }
      // Auto-assign order: stationOrder = max existing for this stop or next global, itemOrder = count within stop
      const sameStop = prev.favorites.filter(f => f.stopId === fav.stopId);
      const stationOrder = sameStop.length > 0
        ? sameStop[0].stationOrder
        : (prev.favorites.length > 0 ? Math.max(...prev.favorites.map(f => f.stationOrder)) + 1 : 0);
      const itemOrder = sameStop.length > 0
        ? Math.max(...sameStop.map(f => f.itemOrder)) + 1
        : 0;
      return { ...prev, favorites: [...prev.favorites, { ...fav, stationOrder, itemOrder }] };
    });
  }, []);

  const removeFavorite = useCallback((directionKey: string) => {
    setContainer(prev => ({
      ...prev,
      favorites: prev.favorites.filter(f => f.directionKey !== directionKey),
    }));
  }, []);

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
      const fav = prev.favorites.find(f => f.directionKey === directionKey);
      if (!fav) return prev;
      const sameStop = prev.favorites
        .filter(f => f.stopId === fav.stopId)
        .sort((a, b) => a.itemOrder - b.itemOrder);
      const idx = sameStop.findIndex(f => f.directionKey === directionKey);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sameStop.length) return prev;

      // Normalize to sequential, then swap
      const normalized = sameStop.map((f, i) => ({ key: f.directionKey, order: i }));
      const tmpOrder = normalized[idx].order;
      normalized[idx].order = normalized[swapIdx].order;
      normalized[swapIdx].order = tmpOrder;

      const orderMap = new Map(normalized.map(n => [n.key, n.order]));
      return {
        ...prev,
        favorites: prev.favorites.map(f => {
          const newOrder = orderMap.get(f.directionKey);
          return newOrder !== undefined ? { ...f, itemOrder: newOrder } : f;
        }),
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

  return (
    <FavoritesContext.Provider value={{
      favorites: container.favorites,
      prefs: container.prefs,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      moveStation,
      moveItem,
      generateReadableUrl,
      generateEncodedUrl,
      hasFavorites: container.favorites.length > 0,
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
