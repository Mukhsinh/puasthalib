'use client'

import Link from 'next/link'
import { Home, ClipboardCheck, MessageSquareWarning, SearchCheck, Headset } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/cn'

export default function BottomNav() {
    const pathname = usePathname()

    const leftTabs = [
        { label: 'Beranda', href: '/', icon: Home },
        { label: 'Survei', href: '/survei', icon: ClipboardCheck },
    ]

    const rightTabs = [
        { label: 'Komplain', href: '/komplain', icon: MessageSquareWarning },
        { label: 'Lacak', href: '/lacak', icon: SearchCheck },
    ]

    return (
        <div className="fixed bottom-0 left-0 z-50 w-full h-[70px] bg-white/90 backdrop-blur-lg border-t border-slate-200/60 rounded-t-[20px] shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.08)]">
            <div className="relative grid h-full max-w-lg grid-cols-5 mx-auto font-medium">
                {/* Left Tabs */}
                {leftTabs.map((tab, idx) => {
                    const isActive = pathname === tab.href
                    return (
                        <Link key={idx} href={tab.href}
                            className={cn(
                                "inline-flex flex-col items-center justify-center transition-colors group",
                                isActive ? "text-primary" : "text-slate-400 hover:text-primary"
                            )}
                        >
                            <tab.icon className={cn("w-[22px] h-[22px] mb-1 transition-transform", isActive && "drop-shadow-md scale-110")} />
                            <span className="text-[10px] font-bold">{tab.label}</span>
                        </Link>
                    )
                })}

                {/* Center Floating WhatsApp CS Button */}
                <div className="flex items-center justify-center">
                    <a
                        href="https://wa.me/1234567890"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute -top-6 w-[56px] h-[56px] bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 border-4 border-white hover:bg-emerald-600 active:scale-95 transition-all"
                    >
                        <Headset className="w-6 h-6 text-white" />
                    </a>
                    <span className="text-[9px] font-bold text-slate-400 mt-6">CS</span>
                </div>

                {/* Right Tabs */}
                {rightTabs.map((tab, idx) => {
                    const isActive = pathname === tab.href || (pathname.startsWith(tab.href) && tab.href !== '/')
                    return (
                        <Link key={idx} href={tab.href}
                            className={cn(
                                "inline-flex flex-col items-center justify-center transition-colors group",
                                isActive ? "text-primary" : "text-slate-400 hover:text-primary"
                            )}
                        >
                            <tab.icon className={cn("w-[22px] h-[22px] mb-1 transition-transform", isActive && "drop-shadow-md scale-110")} />
                            <span className="text-[10px] font-bold">{tab.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
