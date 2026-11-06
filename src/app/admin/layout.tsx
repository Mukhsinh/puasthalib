'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard,
    Inbox,
    BarChart3,
    Settings,
    Users,
    Menu,
    X,
    LogOut,
    Home,
    Building2,
    FileText,
    PieChart,
    Bell,
    ChevronRight,
    ShieldCheck,
    Sparkles,
    Search,
    CheckCircle2,
    Layers,
    QrCode
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { createClient } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

const SIDEBAR_MENUS = [
    {
        group: 'Utama',
        items: [
            { name: 'Dasbor', href: '/admin', icon: LayoutDashboard, badge: null },
            { name: 'Tiket & Laporan', href: '/admin/tiket', icon: Inbox, badge: 'Realtime' },
        ]
    },
    {
        group: 'Analitik & Performa',
        items: [
            { name: 'Analisa Data', href: '/admin/analisa', icon: BarChart3, badge: null },
            { name: 'Analisis Kepuasan', href: '/admin/analisis-kepuasan', icon: PieChart, badge: 'IKM' },
            { name: 'Laporan Eksekutif', href: '/admin/laporan', icon: FileText, badge: null },
        ]
    },
    {
        group: 'Konfigurasi Sistem',
        items: [
            { name: 'Master Unit Kerja', href: '/admin/unit', icon: Building2, badge: null },
            { name: 'Master QR Code', href: '/admin/qrcode', icon: QrCode, badge: 'Baru' },
            { name: 'Master Pengguna', href: '/admin/pengguna', icon: Users, badge: null },
            { name: 'Pengaturan Sistem', href: '/admin/pengaturan', icon: Settings, badge: null },
        ]
    }
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [userProfile, setUserProfile] = useState<any>(null)
    const [notifications, setNotifications] = useState<any[]>([])
    const [isNotifOpen, setIsNotifOpen] = useState(false)
    const [appName, setAppName] = useState('PUAS')
    const [appLogo, setAppLogo] = useState('')
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

    const pathname = usePathname()
    const router = useRouter()
    const supabase = React.useMemo(() => createClient(), [])

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return

            // 1. Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*, units!unit_id(nama)')
                .eq('id', session.user.id)
                .single()
            if (profile) setUserProfile(profile)

            // 2. Settings (app_name + app_logo)
            const { data: settingsArr } = await supabase
                .from('app_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['app_name', 'app_logo'])
            if (settingsArr) {
                settingsArr.forEach((s: any) => {
                    if (s.setting_key === 'app_name' && s.setting_value) setAppName(s.setting_value)
                    if (s.setting_key === 'app_logo' && s.setting_value) setAppLogo(s.setting_value)
                })
            }

            // 3. Notifications
            let notifQuery = supabase
                .from('notifications')
                .select('*')
                .eq('status_baca', false)
                .order('created_at', { ascending: false })
                .limit(20)

            const effectiveProfile = profile || { role: 'user', unit_id: null }
            if (effectiveProfile.role !== 'superadmin' && effectiveProfile.role !== 'admin' && effectiveProfile.unit_id) {
                notifQuery = notifQuery.eq('unit_id', effectiveProfile.unit_id)
            }
            const { data: notifData } = await notifQuery
            setNotifications(notifData || [])
        }

        fetchUserData()

        // Listen for live app settings updates (e.g. logo or name change)
        const handleSettingsUpdated = async () => {
            const { data: settingsArr } = await supabase
                .from('app_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['app_name', 'app_logo'])
            if (settingsArr) {
                settingsArr.forEach((s: any) => {
                    if (s.setting_key === 'app_name' && s.setting_value) setAppName(s.setting_value)
                    if (s.setting_key === 'app_logo') setAppLogo(s.setting_value || '')
                })
            }
        }
        window.addEventListener('app_settings_updated', handleSettingsUpdated)

        // 4. Session Keep-Alive and Inactivity Tracker (30 Menit)
        const isStaySignedIn = typeof window !== 'undefined' && (localStorage.getItem('puas_stay_signed_in') === 'true' || localStorage.getItem('puas_stay_signed_in') === null)

        // Always record initial active timestamp on layout mount
        if (typeof window !== 'undefined') {
            localStorage.setItem('puas_last_activity', Date.now().toString())
        }

        const updateActivity = () => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('puas_last_activity', Date.now().toString())
            }
        }

        // Listen for user activity
        const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
        // Throttle activity updates to once every 10 seconds to avoid performance overhead
        let lastLoggedActivity = Date.now()
        const throttledActivity = () => {
            const now = Date.now()
            if (now - lastLoggedActivity > 10000) {
                lastLoggedActivity = now
                updateActivity()
            }
        }

        activityEvents.forEach(evt => window.addEventListener(evt, throttledActivity, { passive: true }))

        // Check inactivity every 20 seconds
        const IDLE_LIMIT_MS = 30 * 60 * 1000 // 30 Menit
        const idleInterval = setInterval(async () => {
            // If stay signed in is checked, do NOT auto-logout due to inactivity
            if (isStaySignedIn) {
                // Keep session refreshed periodically
                await supabase.auth.getSession()
                return
            }

            if (typeof window !== 'undefined') {
                const lastActStr = localStorage.getItem('puas_last_activity')
                const lastAct = lastActStr ? parseInt(lastActStr, 10) : Date.now()
                const elapsed = Date.now() - lastAct

                if (elapsed >= IDLE_LIMIT_MS) {
                    console.log('User inactive for 30 minutes. Auto logging out...')
                    clearInterval(idleInterval)
                    localStorage.removeItem('puas_last_activity')
                    await supabase.auth.signOut()
                    window.location.href = '/login?timeout=1'
                } else {
                    // Sesi masih aktif, refresh token jika perlu
                    if (elapsed % (5 * 60 * 1000) < 25000) {
                        await supabase.auth.getSession()
                    }
                }
            }
        }, 20000)

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session && _event === 'SIGNED_OUT') {
                router.push('/login')
            }
        })

        return () => {
            window.removeEventListener('app_settings_updated', handleSettingsUpdated)
            activityEvents.forEach(evt => window.removeEventListener(evt, throttledActivity))
            clearInterval(idleInterval)
            subscription.unsubscribe()
        }
    }, [router, supabase])

    useEffect(() => {
        if (!userProfile) return

        const channel = supabase.channel('notifications-realtime-layout')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
                const newNotif = payload.new
                const role = userProfile.role
                const unitId = userProfile.unit_id

                if (role === 'superadmin' || role === 'admin' || newNotif.unit_id === unitId) {
                    setNotifications(prev => [newNotif, ...prev])
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userProfile, supabase])

    const handleMarkAllRead = async () => {
        const ids = notifications.map(n => n.id)
        if (ids.length === 0) return
        await supabase.from('notifications').update({ status_baca: true }).in('id', ids)
        setNotifications([])
        setIsNotifOpen(false)
    }

    const handleOpenNotification = async (notif: any) => {
        await supabase.from('notifications').update({ status_baca: true }).eq('id', notif.id)
        setNotifications(prev => prev.filter(n => n.id !== notif.id))
        setIsNotifOpen(false)
        router.push('/admin/tiket')
    }

    const handleLogout = async () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('puas_stay_signed_in')
            localStorage.removeItem('puas_last_activity')
            document.cookie = 'puas_stay_signed_in=; path=/; max-age=0'
        }
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setIsMobileOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar (MATTE DARK EMERALD GREEN APPROACHING BLACK) */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 bg-[#042017] text-white transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block flex flex-col shadow-xl border-r border-emerald-900/40 shrink-0",
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header Branding */}
                <div className="h-20 flex items-center px-6 border-b border-emerald-900/50 bg-emerald-950/60 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="flex items-center gap-3 relative">
                        {appLogo ? (
                            <div className="w-10 h-10 rounded-2xl bg-white/10 p-1 shadow-lg border border-emerald-800/40 flex items-center justify-center shrink-0">
                                <img src={appLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-2xl bg-white/10 p-0.5 shadow-lg border border-emerald-800/40 flex items-center justify-center shrink-0">
                                <div className="w-full h-full bg-emerald-800 rounded-[12px] flex items-center justify-center text-emerald-100 font-black text-xl">
                                    {appName.charAt(0)}
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-base font-black text-white tracking-wide">{appName}</span>
                                <span className="text-[9px] font-black bg-emerald-500 text-emerald-950 px-1.5 py-0.5 rounded-full uppercase shadow-xs">MR</span>
                            </div>
                            <p className="text-[11px] text-emerald-200/80 font-medium">Panel Administrasi Modul</p>
                        </div>
                    </div>
                    <button className="ml-auto lg:hidden text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10" onClick={() => setIsMobileOpen(false)}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar">
                    {SIDEBAR_MENUS.map((group, gIdx) => {
                        if (group.group.includes('Konfigurasi') && userProfile?.role === 'user') {
                            return null
                        }
                        return (
                            <div key={gIdx} className="space-y-2">
                                <div className="px-3 flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">{group.group}</p>
                                </div>
                                <nav className="space-y-1">
                                    {group.items.map((item, iIdx) => {
                                        const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                                        return (
                                            <Link
                                                key={iIdx}
                                                href={item.href}
                                                onClick={() => setIsMobileOpen(false)}
                                                className={cn(
                                                    "group relative flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-xs transition-all duration-200",
                                                    isActive
                                                        ? "bg-emerald-900/90 text-white font-black shadow-md border border-emerald-700/50"
                                                        : "text-emerald-100/80 hover:text-white hover:bg-emerald-900/40"
                                                )}
                                            >
                                                <div className="flex items-center gap-3.5">
                                                    <item.icon className={cn(
                                                        "w-4 h-4 transition-transform group-hover:scale-110 duration-200",
                                                        isActive ? "text-emerald-400" : "text-emerald-300/70 group-hover:text-white"
                                                    )} />
                                                    <span>{item.name}</span>
                                                </div>
                                                {item.badge && (
                                                    <span className={cn(
                                                        "text-[9px] font-extrabold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                                                        isActive
                                                            ? "bg-emerald-400 text-emerald-950 border-emerald-300"
                                                            : "bg-emerald-900/60 text-emerald-300 border-emerald-700/40"
                                                    )}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="activeSidePill"
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-400 rounded-l-full shadow-xs"
                                                    />
                                                )}
                                            </Link>
                                        )
                                    })}
                                </nav>
                            </div>
                        )
                    })}
                </div>

                {/* Footer User Info */}
                <div className="p-4 border-t border-emerald-900/50 bg-emerald-950/60 space-y-3">
                    <div className="p-3 bg-emerald-900/30 backdrop-blur-md border border-emerald-800/40 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-0.5 shrink-0 shadow-md">
                            <img
                                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${userProfile?.nama_lengkap || 'Admin'}&backgroundColor=0284c7`}
                                alt="User Avatar"
                                className="w-full h-full object-cover rounded-[10px]"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                                {userProfile?.nama_lengkap || 'Pengguna Admin'}
                            </p>
                            <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider mt-0.5">
                                {userProfile?.role === 'superadmin' ? 'Super Admin' : userProfile?.role === 'admin' ? 'Admin Unit' : (userProfile?.units?.nama || 'Operator')}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                            onClick={() => router.push('/')}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-emerald-800/40"
                        >
                            <Home className="w-3.5 h-3.5 text-emerald-300" /> Beranda
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-500/30"
                        >
                            <LogOut className="w-3.5 h-3.5 text-red-300" /> Keluar
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
                {/* Clean Top Navbar */}
                <header className="h-20 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-400">
                            {appLogo && (
                                <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain rounded-xl p-0.5 bg-slate-50 border border-slate-200 shadow-xs" />
                            )}
                            <Link href="/admin" className="hover:text-emerald-700 text-slate-500 font-extrabold transition-colors hidden sm:inline">Portal Admin</Link>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
                            <span className="text-slate-800 capitalize font-black">
                                {pathname.split('/').pop() || 'Dasbor'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Realtime Notification Popover Button */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className={cn(
                                    "relative p-2.5 rounded-xl border transition-all",
                                    notifications.length > 0
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                )}
                            >
                                <Bell className="w-4 h-4" />
                                {notifications.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-bounce shadow-xs">
                                        {notifications.length}
                                    </span>
                                )}
                            </button>

                            <AnimatePresence>
                                {isNotifOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden"
                                        >
                                            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Bell className="w-4 h-4 text-emerald-300" />
                                                    <h3 className="font-extrabold text-xs">Notifikasi Realtime</h3>
                                                </div>
                                                {notifications.length > 0 && (
                                                    <button
                                                        onClick={handleMarkAllRead}
                                                        className="text-[10px] text-emerald-300 hover:text-white font-bold flex items-center gap-1"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3" /> Tandai Dibaca
                                                    </button>
                                                )}
                                            </div>

                                            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                                                {notifications.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-400">
                                                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                        <p className="text-xs font-semibold">Tidak ada notifikasi baru.</p>
                                                    </div>
                                                ) : (
                                                    notifications.map((n) => (
                                                        <div
                                                            key={n.id}
                                                            onClick={() => handleOpenNotification(n)}
                                                            className="p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-1"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                                    {n.judul || 'Tiket Masuk'}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-bold">
                                                                    {new Date(n.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-800 leading-snug">{n.pesan}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* User Profile Pill */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="flex items-center gap-3 p-1.5 pr-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all"
                            >
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 p-0.5 shrink-0">
                                    <img
                                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${userProfile?.nama_lengkap || 'Admin'}&backgroundColor=0284c7`}
                                        alt="User Avatar"
                                        className="w-full h-full object-cover rounded-[10px]"
                                    />
                                </div>
                                <div className="text-left hidden md:block">
                                    <p className="text-xs font-black text-slate-900 leading-tight">
                                        {userProfile?.nama_lengkap || 'Pengguna Admin'}
                                    </p>
                                    <p className="text-[10px] text-emerald-600 font-extrabold capitalize">
                                        {userProfile?.role || 'Superadmin'}
                                    </p>
                                </div>
                            </button>

                            <AnimatePresence>
                                {isProfileMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-2 space-y-1"
                                        >
                                            <div className="p-3 border-b border-slate-100">
                                                <p className="text-xs font-black text-slate-900 truncate">{userProfile?.nama_lengkap}</p>
                                                <p className="text-[10px] text-slate-500 font-semibold truncate">{userProfile?.email}</p>
                                            </div>
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            >
                                                <LogOut className="w-4 h-4" /> Keluar Sesi
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* Page View Container */}
                <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-100">
                    {children}
                </main>
            </div>
        </div>
    )
}
