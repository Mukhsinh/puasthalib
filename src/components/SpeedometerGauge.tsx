'use client'

import React from 'react'

interface SpeedometerGaugeProps {
    value: number
    min?: number
    max?: number
    size?: number
    title?: string
    subtitle?: string
    unit?: string
    showTicks?: boolean
    gradeLabel?: string
    colorScheme?: 'ikm' | 'csat' | 'resolution'
    compact?: boolean
}

export default function SpeedometerGauge({
    value = 0,
    min = 0,
    max = 100,
    size = 220,
    title,
    subtitle,
    unit = '',
    showTicks = true,
    gradeLabel,
    compact = false
}: SpeedometerGaugeProps) {
    // Normalisasi nilai ke 0 - 100%
    const clampedValue = Math.min(Math.max(value, min), max)
    const percentage = ((clampedValue - min) / (max - min)) * 100

    // Sudut busur gauge: -120 derajat sampai +120 derajat (total 240 derajat)
    const startAngle = -120
    const endAngle = 120
    const angleRange = endAngle - startAngle
    const needleAngle = startAngle + (percentage / 100) * angleRange

    // Konfigurasi radius
    const cx = size / 2
    const cy = size * 0.52
    const radius = size * 0.36
    const strokeWidth = size * 0.08

    const isSmall = size < 160 || compact

    // Helper untuk membuat busur SVG (polar to cartesian)
    const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
        return {
            x: centerX + r * Math.cos(angleInRadians),
            y: centerY + r * Math.sin(angleInRadians),
        }
    }

    const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
        const start = polarToCartesian(x, y, r, endA)
        const end = polarToCartesian(x, y, r, startA)
        const largeArcFlag = endA - startA <= 180 ? '0' : '1'
        return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ')
    }

    const arc1 = describeArc(cx, cy, radius, startAngle, startAngle + angleRange * 0.25)
    const arc2 = describeArc(cx, cy, radius, startAngle + angleRange * 0.25, startAngle + angleRange * 0.5)
    const arc3 = describeArc(cx, cy, radius, startAngle + angleRange * 0.5, startAngle + angleRange * 0.75)
    const arc4 = describeArc(cx, cy, radius, startAngle + angleRange * 0.75, endAngle)

    const ticks = [0, 25, 50, 75, 100]

    let statusColor = '#10b981'
    let statusBg = 'bg-emerald-50 text-emerald-800 border-emerald-300'
    if (percentage < 35) {
        statusColor = '#ef4444'
        statusBg = 'bg-rose-50 text-rose-800 border-rose-300'
    } else if (percentage < 65) {
        statusColor = '#f59e0b'
        statusBg = 'bg-amber-50 text-amber-800 border-amber-300'
    } else if (percentage < 85) {
        statusColor = '#3b82f6'
        statusBg = 'bg-blue-50 text-blue-800 border-blue-300'
    }

    // Calculated height with safe margin for text
    const svgHeight = size * 0.65
    const totalHeight = isSmall ? size * 0.95 : size * 0.85

    return (
        <div className="flex flex-col items-center justify-between select-none w-full" style={{ minHeight: totalHeight }}>
            {title && (
                <div className="text-center mb-1 w-full px-1">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 truncate">{title}</h4>
                    {subtitle && <p className="text-[9px] text-slate-400 font-medium truncate">{subtitle}</p>}
                </div>
            )}

            <div className="relative flex flex-col items-center justify-start w-full" style={{ width: size, height: svgHeight }}>
                <svg width={size} height={svgHeight} viewBox={`0 0 ${size} ${svgHeight}`} className="overflow-visible">
                    <defs>
                        <filter id={`needle-shadow-${size}`} x="-30%" y="-30%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.2" />
                        </filter>
                    </defs>

                    {/* Track Background */}
                    <path
                        d={describeArc(cx, cy, radius, startAngle, endAngle)}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth={strokeWidth + 1}
                        strokeLinecap="round"
                    />

                    {/* Arcs */}
                    <path d={arc1} fill="none" stroke="#ef4444" strokeWidth={strokeWidth} strokeLinecap="round" />
                    <path d={arc2} fill="none" stroke="#f59e0b" strokeWidth={strokeWidth} />
                    <path d={arc3} fill="none" stroke="#3b82f6" strokeWidth={strokeWidth} />
                    <path d={arc4} fill="none" stroke="#10b981" strokeWidth={strokeWidth} strokeLinecap="round" />

                    {/* Ticks */}
                    {showTicks && !isSmall && ticks.map((t, idx) => {
                        const tickAng = startAngle + (t / 100) * angleRange
                        const pInner = polarToCartesian(cx, cy, radius - strokeWidth / 2 - 3, tickAng)
                        const pOuter = polarToCartesian(cx, cy, radius - strokeWidth / 2 - 7, tickAng)
                        const pText = polarToCartesian(cx, cy, radius - strokeWidth / 2 - 14, tickAng)
                        const tickVal = Math.round(min + (t / 100) * (max - min))

                        return (
                            <g key={idx}>
                                <line x1={pInner.x} y1={pInner.y} x2={pOuter.x} y2={pOuter.y} stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                                <text x={pText.x} y={pText.y} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.045} fontWeight="700" fill="#64748b">
                                    {tickVal}
                                </text>
                            </g>
                        )
                    })}

                    {/* Needle */}
                    <g
                        transform={`rotate(${needleAngle} ${cx} ${cy})`}
                        style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                        filter={`url(#needle-shadow-${size})`}
                    >
                        <polygon
                            points={`${cx - (isSmall ? 2 : 3)},${cy} ${cx + (isSmall ? 2 : 3)},${cy} ${cx},${cy - radius + strokeWidth * 0.2}`}
                            fill="#1e293b"
                        />
                        <circle cx={cx} cy={cy - radius + strokeWidth * 0.4} r={isSmall ? 2 : 3.5} fill={statusColor} />
                    </g>

                    {/* Pivot */}
                    <circle cx={cx} cy={cy} r={isSmall ? 6 : 10} fill="#0f172a" stroke="#ffffff" strokeWidth={isSmall ? 1.5 : 2} />
                    <circle cx={cx} cy={cy} r={isSmall ? 2.5 : 4} fill={statusColor} />
                </svg>

                {/* Score & Badge diposisikan di bawah SVG dengan margin aman */}
                <div className="flex flex-col items-center justify-center -mt-1 z-10">
                    <div className="flex items-baseline gap-1">
                        <span className={`font-black tracking-tight text-slate-900 ${isSmall ? 'text-lg' : 'text-2xl'}`}>
                            {Number(clampedValue).toFixed(1)}
                        </span>
                        {unit && <span className="text-[10px] font-bold text-slate-400">{unit}</span>}
                    </div>

                    {gradeLabel && (
                        <span className={`inline-block font-black uppercase tracking-wider border rounded-md shadow-2xs mt-0.5 ${isSmall ? 'text-[9px] px-1.5 py-0.2' : 'text-[10px] px-2.5 py-0.5 rounded-full'
                            } ${statusBg}`}>
                            {gradeLabel}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
