export interface PadelCategory {
  name: string
  fullName: string
  min: number
  max: number
  color: string
}

const CATEGORIES: PadelCategory[] = [
  { name: '8va', fullName: 'Octava',  min: 0,    max: 899,  color: 'bg-neutral-500' },
  { name: '7ma', fullName: 'Séptima', min: 900,  max: 999,  color: 'bg-blue-500' },
  { name: '6ta', fullName: 'Sexta',   min: 1000, max: 1099, color: 'bg-green-500' },
  { name: '5ta', fullName: 'Quinta',  min: 1100, max: 1199, color: 'bg-yellow-500' },
  { name: '4ta', fullName: 'Cuarta',  min: 1200, max: 1349, color: 'bg-orange-500' },
  { name: '3ra', fullName: 'Tercera', min: 1350, max: 9999, color: 'bg-red-500' },
]

export function getCategoryFromELO(elo: number): PadelCategory {
  return CATEGORIES.find((c) => elo >= c.min && elo <= c.max) ?? CATEGORIES[0]
}

export function getCategoryBadge(elo: number): string {
  return getCategoryFromELO(elo).name
}
