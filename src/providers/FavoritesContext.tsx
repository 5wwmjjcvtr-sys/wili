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
      const favorites = exists
        ? prev.favorites.filter(f => f.directionKey !== fav.directionKey)
        : [...prev.favorites, fav];
      return { ...prev, favorites };
    });
  }, []);

  const removeFavorite = useCallback((directionKey: string) => {
    setContainer(prev => ({
      ...prev,
      favorites: prev.favorites.filter(f => f.directionKey !== directionKey),
    }));
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
