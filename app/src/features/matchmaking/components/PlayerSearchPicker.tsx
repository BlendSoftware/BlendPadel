import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useMatchStore } from '@/stores/match-store'
import type { MatchType, PlayerSearchResult } from '../types'

interface PlayerSearchPickerProps {
  selectedPlayers: PlayerSearchResult[]
  maxPlayers: number
  onAdd: (player: PlayerSearchResult) => void
  onRemove: (playerId: string) => void
  label?: string
  excludeIds?: string[]
  matchType?: MatchType
}

export function PlayerSearchPicker({
  selectedPlayers,
  maxPlayers,
  onAdd,
  onRemove,
  label = 'Buscar jugadores',
  excludeIds = [],
  matchType,
}: PlayerSearchPickerProps) {
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchResults = useMatchStore((s) => s.searchResults)
  const isSearching = useMatchStore((s) => s.isSearching)
  const searchPlayers = useMatchStore((s) => s.searchPlayers)
  const clearSearch = useMatchStore((s) => s.clearSearch)

  const selectedIds = new Set(selectedPlayers.map((p) => p.id))
  const allExcluded = new Set([...excludeIds, ...selectedIds])

  const filteredResults = searchResults.filter((p) => {
    if (allExcluded.has(p.id)) return false
    if (matchType === 'male' && p.gender && p.gender !== 'male') return false
    if (matchType === 'female' && p.gender && p.gender !== 'female') return false
    return true
  })
  const canAdd = selectedPlayers.length < maxPlayers

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      clearSearch()
    }
  }, [clearSearch])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      clearSearch()
      return
    }
    debounceRef.current = setTimeout(() => {
      searchPlayers(value, { excludeIds: Array.from(allExcluded), matchType })
    }, 350)
  }

  const handleAdd = (player: PlayerSearchResult) => {
    if (!canAdd) return
    onAdd(player)
    setQuery('')
    clearSearch()
  }

  return (
    <div className="space-y-3">
      {label && (
        <label className="text-sm font-medium text-text-secondary">{label}</label>
      )}

      {/* Selected players */}
      {selectedPlayers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedPlayers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-bg-input rounded-xl px-3 py-2 border border-border"
            >
              <Avatar src={p.avatar_url} name={p.name} size="xs" />
              <span className="text-sm text-text-primary">{p.name}</span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                aria-label={`Quitar a ${p.name}`}
                className="text-text-secondary hover:text-trust-low transition-colors min-h-6 min-w-6 flex items-center justify-center"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      {canAdd && (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
            <Search size={16} aria-hidden="true" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Buscar por nombre..."
            aria-label="Buscar jugador"
            className="w-full rounded-xl bg-bg-input text-text-primary placeholder:text-text-secondary border border-border pl-10 pr-4 py-2.5 text-sm min-h-11 focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green transition-colors"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-padel-green border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Results dropdown */}
      {filteredResults.length > 0 && (
        <ul
          className="bg-bg-card border border-border rounded-xl overflow-hidden"
          role="listbox"
          aria-label="Resultados de búsqueda"
        >
          {filteredResults.slice(0, 5).map((player) => (
            <li key={player.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 min-h-11 hover:bg-bg-input transition-colors text-left focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-padel-green"
                onClick={() => handleAdd(player)}
              >
                <Avatar src={player.avatar_url} name={player.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{player.name}</p>
                  <p className="text-xs text-text-secondary">ELO {player.elo}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* BUG 8 FIX: Show "no results" feedback when search is done and empty */}
      {!isSearching && query.trim().length >= 2 && filteredResults.length === 0 && (
        <p className="text-sm text-text-secondary text-center py-3">
          No se encontraron jugadores para &ldquo;{query}&rdquo;
        </p>
      )}

      <p className="text-xs text-text-secondary">
        {selectedPlayers.length}/{maxPlayers} jugadores seleccionados
      </p>
    </div>
  )
}
