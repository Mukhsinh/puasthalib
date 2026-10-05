'use client'

import { useEffect, useState } from 'react'
import { Clock, MapPin, Moon, Sun, Sunrise, Sunset } from 'lucide-react'

interface PrayerTime {
    name: string
    time: string
    icon: any
}

function getPekalonganPrayerTimes(date: Date): { [key: string]: string } {
    const month = date.getMonth()
    const offsets = [
        { subuh: "04:25", terbit: "05:40", dzuhur: "11:58", ashar: "15:18", maghrib: "18:04", isya: "19:15" },
        { subuh: "04:30", terbit: "05:43", dzuhur: "12:02", ashar: "15:13", maghrib: "18:07", isya: "19:16" },
        { subuh: "04:30", terbit: "05:41", dzuhur: "11:59", ashar: "15:03", maghrib: "18:02", isya: "19:10" },
        { subuh: "04:26", terbit: "05:37", dzuhur: "11:52", ashar: "15:10", maghrib: "17:52", isya: "19:02" },
        { subuh: "04:23", terbit: "05:36", dzuhur: "11:47", ashar: "15:08", maghrib: "17:46", isya: "18:58" },
        { subuh: "04:24", terbit: "05:39", dzuhur: "11:48", ashar: "15:09", maghrib: "17:46", isya: "19:00" },
        { subuh: "04:27", terbit: "05:42", dzuhur: "11:51", ashar: "15:12", maghrib: "17:50", isya: "19:02" },
        { subuh: "04:26", terbit: "05:40", dzuhur: "11:51", ashar: "15:10", maghrib: "17:51", isya: "19:01" },
        { subuh: "04:20", terbit: "05:32", dzuhur: "11:46", ashar: "14:59", maghrib: "17:48", isya: "18:56" },
        { subuh: "04:11", terbit: "05:24", dzuhur: "11:40", ashar: "14:48", maghrib: "17:44", isya: "18:53" },
        { subuh: "04:06", terbit: "05:20", dzuhur: "11:39", ashar: "14:53", maghrib: "17:46", isya: "18:57" },
        { subuh: "04:12", terbit: "05:27", dzuhur: "11:45", ashar: "15:08", maghrib: "17:54", isya: "19:06" }
    ]
    return offsets[month] || offsets[9]
}

export default function PrayerTimesBar() {
    const [mounted, setMounted] = useState(false)
    const [now, setNow] = useState<Date | null>(null)
    const [nextPrayer, setNextPrayer] = useState<{ name: string; hours: number; minutes: number } | null>(null)
    const [activePrayerName, setActivePrayerName] = useState<string>('')

    useEffect(() => {
        setMounted(true)
        setNow(new Date())
        const timer = setInterval(() => {
            setNow(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    const date = now || new Date()
    const times = getPekalonganPrayerTimes(date)

    const list: PrayerTime[] = [
        { name: 'Subuh', time: times.subuh, icon: Sunrise },
        { name: 'Terbit', time: times.terbit, icon: Sun },
        { name: 'Dzuhur', time: times.dzuhur, icon: Sun },
        { name: 'Ashar', time: times.ashar, icon: Sun },
        { name: 'Maghrib', time: times.maghrib, icon: Sunset },
        { name: 'Isya', time: times.isya, icon: Moon },
    ]

    useEffect(() => {
        if (!now) return
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const currentSeconds = currentMinutes * 60 + now.getSeconds()

        const scheduleInSeconds = list.map(item => {
            const [h, m] = item.time.split(':').map(Number)
            return { name: item.name, time: item.time, seconds: (h * 60 + m) * 60 }
        })

        let upcoming = scheduleInSeconds.find(s => s.seconds > currentSeconds)
        let diffInSeconds = 0

        if (upcoming) {
            diffInSeconds = upcoming.seconds - currentSeconds
        } else {
            const tomorrowSubuh = scheduleInSeconds[0]
            upcoming = tomorrowSubuh
            const secondsTillMidnight = (24 * 3600) - currentSeconds
            diffInSeconds = secondsTillMidnight + tomorrowSubuh.seconds
        }

        const hrs = Math.floor(diffInSeconds / 3600)
        const mins = Math.floor((diffInSeconds % 3600) / 60)

        setNextPrayer({
            name: upcoming.name,
            hours: hrs,
            minutes: mins
        })

        const passed = scheduleInSeconds.filter(s => s.seconds <= currentSeconds)
        if (passed.length > 0) {
            setActivePrayerName(passed[passed.length - 1].name)
        } else {
            setActivePrayerName('Isya')
        }
    }, [now])

    if (!mounted) {
        return <div className="w-full h-24 bg-blue-600 rounded-2xl mb-6 animate-pulse" />
    }

    return (
        <div className="w-full mb-6">
            {/* Shorter, compact frame height with STYLISH MATTE EMERALD GREEN background */}
            <div className="bg-emerald-800 rounded-2xl p-3 sm:p-3.5 shadow-md text-white relative overflow-hidden">
                {/* Top Row: Location & Next Prayer Countdown */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-emerald-700">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-950/40 flex items-center justify-center text-white">
                            <MapPin className="w-4 h-4 text-emerald-300" />
                        </div>
                        <div className="leading-tight">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-extrabold text-white">Waktu Sholat</span>
                                <span className="text-[10px] font-bold text-emerald-100 bg-emerald-950/50 px-2 py-0.5 rounded-full">
                                    Kota Pekalongan
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Next Prayer Countdown Badge */}
                    {nextPrayer && (
                        <div className="flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-600/40 rounded-lg px-2.5 py-1">
                            <Clock className="w-3.5 h-3.5 text-amber-300" />
                            <div className="text-right leading-tight">
                                <span className="text-[9px] uppercase tracking-wider text-emerald-200 font-bold block">
                                    Menuju {nextPrayer.name}
                                </span>
                                <span className="text-xs font-black text-white font-mono">
                                    {nextPrayer.hours > 0 ? `${nextPrayer.hours}j ` : ''}{nextPrayer.minutes}m lagi
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Prayer Times Grid */}
                <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                    {list.map((item, idx) => {
                        const isNext = nextPrayer?.name === item.name
                        const isActive = activePrayerName === item.name && !isNext
                        const Icon = item.icon

                        return (
                            <div
                                key={idx}
                                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border transition-all ${isNext
                                    ? 'bg-amber-400 border-amber-300 text-slate-900 shadow font-bold scale-[1.02]'
                                    : isActive
                                        ? 'bg-emerald-700 border-emerald-600 text-white font-semibold'
                                        : 'bg-emerald-950/30 border-emerald-700/50 text-emerald-100 hover:bg-emerald-700/50'
                                    }`}
                            >
                                <Icon className={`w-3.5 h-3.5 mb-0.5 ${isNext ? 'text-slate-900' : 'text-emerald-200'}`} />
                                <span className="text-[10px] font-bold tracking-tight leading-tight">{item.name}</span>
                                <span className={`text-[10px] sm:text-[11px] font-black font-mono leading-tight ${isNext ? 'text-slate-900' : 'text-white'}`}>
                                    {item.time}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
