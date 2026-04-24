import { useState } from 'react'
import type { EloHistoryEntry } from '@/types'

interface EloChartProps {
  entries: EloHistoryEntry[]
}

const WIDTH = 300
const HEIGHT = 80
const PADDING = { top: 10, right: 8, bottom: 20, left: 36 }

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export function EloChart({ entries }: EloChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-text-secondary text-sm">
        Sin historial ELO aún
      </div>
    )
  }

  if (entries.length === 1) {
    return (
      <div className="flex items-center justify-center h-20 text-text-secondary text-sm">
        ELO actual: <span className="text-padel-green font-bold ml-1">{entries[0].elo_after}</span>
      </div>
    )
  }

  const elos = entries.map((e) => e.elo_after)
  const minElo = Math.min(...elos)
  const maxElo = Math.max(...elos)
  const eloRange = maxElo - minElo || 1

  const chartW = WIDTH - PADDING.left - PADDING.right
  const chartH = HEIGHT - PADDING.top - PADDING.bottom

  const toX = (i: number) => PADDING.left + (i / (entries.length - 1)) * chartW
  const toY = (elo: number) => PADDING.top + chartH - ((elo - minElo) / eloRange) * chartH

  const points = entries.map((e, i) => ({ x: toX(i), y: toY(e.elo_after), entry: e }))

  // Build SVG path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  // Build area path (close to bottom)
  const areaPath = [
    `M ${points[0].x.toFixed(1)} ${(PADDING.top + chartH).toFixed(1)}`,
    ...points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    `L ${points[points.length - 1].x.toFixed(1)} ${(PADDING.top + chartH).toFixed(1)}`,
    'Z',
  ].join(' ')

  const active = activeIndex !== null ? points[activeIndex] : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: '80px' }}
        role="img"
        aria-label="Historial de ELO"
      >
        <defs>
          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#eloGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#22c55e"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Y axis labels */}
        <text
          x={PADDING.left - 4}
          y={PADDING.top + 4}
          textAnchor="end"
          fill="#94a3b8"
          fontSize="8"
        >
          {maxElo}
        </text>
        <text
          x={PADDING.left - 4}
          y={PADDING.top + chartH}
          textAnchor="end"
          fill="#94a3b8"
          fontSize="8"
        >
          {minElo}
        </text>

        {/* X axis labels — first and last */}
        <text
          x={points[0].x}
          y={HEIGHT - 4}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="7"
        >
          {formatDateShort(entries[0].created_at)}
        </text>
        <text
          x={points[points.length - 1].x}
          y={HEIGHT - 4}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="7"
        >
          {formatDateShort(entries[entries.length - 1].created_at)}
        </text>

        {/* Active point tooltip line */}
        {active && (
          <line
            x1={active.x}
            y1={PADDING.top}
            x2={active.x}
            y2={PADDING.top + chartH}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3,2"
          />
        )}

        {/* Hit areas (invisible) for each point */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - 12}
            y={PADDING.top}
            width="24"
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            onTouchStart={() => setActiveIndex(i)}
            onTouchEnd={() => setActiveIndex(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={activeIndex === i ? 4 : 2.5}
            fill={activeIndex === i ? '#22c55e' : '#16a34a'}
            stroke="#0f172a"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Tooltip */}
      {active && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 bg-bg-card border border-border rounded-lg px-2 py-1 text-xs pointer-events-none z-10"
          style={{
            left: `${(active.x / WIDTH) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="text-text-primary font-bold">{active.entry.elo_after}</span>
          {active.entry.delta !== 0 && (
            <span
              className={
                active.entry.delta > 0 ? 'text-trust-high ml-1' : 'text-trust-low ml-1'
              }
            >
              {active.entry.delta > 0 ? `+${active.entry.delta}` : active.entry.delta}
            </span>
          )}
          <p className="text-text-secondary">{formatDateShort(active.entry.created_at)}</p>
        </div>
      )}
    </div>
  )
}
