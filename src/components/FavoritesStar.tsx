import { Star } from 'lucide-react';
import { useFavorites } from '@/providers/FavoritesContext';
import { Favorite } from '@/lib/favorites';

interface Props {
  favorite: Favorite;
}

export function FavoritesStar({ favorite }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(favorite.directionKey);

  return (
    <button
      onClick={() => toggleFavorite(favorite)}
      className="p-1 rounded-full hover:bg-muted transition-colors"
      aria-label={active ? 'Favorit entfernen' : 'Als Favorit speichern'}
    >
      <Star
        className={`h-4 w-4 ${active ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
      />
    </button>
  );
}
