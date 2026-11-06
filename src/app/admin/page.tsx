import React from 'react'
import {
    Users,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Activity,
    ArrowRight,
    TrendingUp,
    Sparkles,
    ShieldCheck,
    MessageSquare,
    ChevronRight,
    BarChart3,
    Zap,
    Building2
} from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    let profile = null
    if (session) {
        const { data } = await supabase.from('profiles').select('role, unit_id, nama_lengkap').eq('id', session.user.id).single()
        profile = data
    }

    const applyUnitFilter = (query: any) => {
        if (profile?.role === 'user' && profile?.unit_id) {
            return query.eq('unit_id', profile.unit_id)
        }
        return query
    }

    const { count: countTotal } = await applyUnitFilter(supabase.from('tickets').select('*', { count: 'exact', head: true }))
    const { count: countMenunggu } = await applyUnitFilter(supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'Terkirim'))
    const { count: countProses } = await applyUnitFilter(supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'Proses'))
    const { count: countSelesai } = await applyUnitFilter(supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'Selesai'))

    // Calculate dynamic SLA compliance
    const totalCountVal = countTotal || 0
    const selesaiCountVal = countSelesai || 0
    const slaRate = totalCountVal > 0 ? Math.min(100, Math.round((selesaiCountVal / totalCountVal) * 100)) : 100

    // Fetch latest tickets requiring action
    const { data: latestTickets } = await applyUnitFilter(
        supabase
            .from('tickets')
            .select('*, units!unit_id(nama)')
            .neq('status', 'Selesai')
            .order('created_at', { ascending: false })
            .limit(6)
    )

    // Fetch institutional settings for dashboard header
    const { data: settingsData } = await supabase.from('app_settings').select('setting_key, setting_value')
    const settingsMap: Record<string, string> = {}
    if (settingsData) {
        settingsData.forEach((s: any) => {
            if (s.setting_key && s.setting_value) settingsMap[s.setting_key] = s.setting_value
        })
    }
    const appLogo = settingsMap['app_logo'] || ''
    const appName = settingsMap['app_name'] || 'PUAS'
    const namaSubInstansi = settingsMap['nama_sub_instansi'] || 'RSUD Mayjen H.A Thalib'
    const namaInstansi = settingsMap['nama_instansi'] || 'Pemerintah Kota Sungai Penuh'

    const STATS = [
        {
            label: 'Total Tiket Masuk',
            value: totalCountVal,
            subtext: 'Seluruh riwayat aduan & pengaduan',
            icon: Users,
            bgColor: 'bg-blue-50 text-blue-600',
            borderColor: 'border-blue-200'
        },
        {
            label: 'Menunggu Tindakan',
            value: countMenunggu || 0,
            subtext: 'Tiket baru perlu respon awal',
            icon: Clock,
            bgColor: 'bg-amber-50 text-amber-600',
            borderColor: 'border-amber-200'
        },
        {
            label: 'Dalam Penanganan',
            value: countProses || 0,
            subtext: 'Sedang ditindaklanjuti unit',
            icon: Zap,
            bgColor: 'bg-teal-50 text-teal-600',
            borderColor: 'border-teal-200'
        },
        {
            label: 'Selesai Ditangani',
            value: selesaiCountVal,
            subtext: 'Telah diberikan solusi resmi',
            icon: CheckCircle2,
            bgColor: 'bg-emerald-50 text-emerald-600',
            borderColor: 'border-emerald-200'
        },
    ]

    return (
        <div className="space-y-8 pb-10 font-sans">
            {/* Executive Welcome & Institutional Header with Logo */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex items-center gap-4 relative z-10">
                    {appLogo ? (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 border border-slate-200/90 shadow-md shrink-0 flex items-center justify-center">
                            <img src={appLogo} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md flex items-center justify-center font-black text-2xl shrink-0">
                            <Building2 className="w-8 h-8" />
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                {namaInstansi}
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                            {namaSubInstansi}
                        </h1>
                        <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
                            Panel Dasbor Eksekutif • Sistem Informasi & Evaluasi Layanan Terpadu ({appName})
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold self-end sm:self-center">
                    <span className="px-3.5 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200/80 font-bold">
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* KPI Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {STATS.map((stat, idx) => (
                    <div
                        key={idx}
                        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{stat.label}</span>
                                <div className={`w-11 h-11 rounded-2xl ${stat.bgColor} flex items-center justify-center font-extrabold border ${stat.borderColor} group-hover:scale-110 transition-transform duration-300`}>
                                    <stat.icon className="w-5 h-5 stroke-[2.5]" />
                                </div>
                            </div>
                            <div className="mt-4 flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
                                <span className="text-xs font-extrabold text-slate-400">tiket</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">{stat.subtext}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Layout (Tiket Pending + SLA Indicator) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Antrean Tiket Butuh Tindakan (2 Cols) */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />
                                <h2 className="text-lg font-black text-slate-900">Antrean Tiket Perlu Respon</h2>
                            </div>
                            <p className="text-xs text-slate-500 font-semibold mt-1">Daftar tiket baru dan sedang dalam proses penanganan</p>
                        </div>

                        <Link
                            href="/admin/tiket"
                            className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors"
                        >
                            Lihat Selengkapnya <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {(!latestTickets || latestTickets.length === 0) ? (
                            <div className="py-12 px-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-3">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto opacity-80" />
                                <p className="text-sm font-bold text-slate-700">Semua Tiket Telah Ditangani</p>
                                <p className="text-xs text-slate-400">Tidak ada aduan yang menggantung atau belum direspon saat ini.</p>
                            </div>
                        ) : (
                            latestTickets.map((t: any) => (
                                <div
                                    key={t.id}
                                    className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <MessageSquare className="w-5 h-5" />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                                    {t.jenis ? t.jenis.replace(/_/g, ' ') : 'PENGADUAN'}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                                                    {t.tracking_number}
                                                </span>
                                            </div>
                                            <p className="text-xs font-semibold text-slate-600 line-clamp-1">
                                                {t.deskripsi || 'Tidak ada deskripsi rinci'}
                                            </p>
                                            <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                                                <span className="flex items-center gap-1 font-bold text-slate-500">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                    {t.units?.nama || 'Global'}
                                                </span>
                                                <span>•</span>
                                                <span>{new Date(t.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border ${t.status === 'Terkirim'
                                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                                            : 'bg-teal-50 text-teal-600 border-teal-200'
                                            }`}>
                                            {t.status}
                                        </span>
                                        <Link
                                            href="/admin/tiket"
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                                        >
                                            Respon
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Performa SLA & Quick Summary (1 Col) */}
                <div className="space-y-6">
                    {/* SLA Compliance Widget (Clean White Card) */}
                    <div className="rounded-3xl bg-white p-6 sm:p-8 text-slate-900 shadow-sm border border-slate-200/80 space-y-6 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Kepatuhan Respon SLA</h3>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Target 95%</span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-slate-900 tracking-tight">{slaRate}%</span>
                                <span className="text-xs font-bold text-emerald-600">Tingkat Penanganan</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                Persentase tiket aduan yang telah dituntaskan dan diberikan solusi secara memadai.
                            </p>
                        </div>

                        <div className="space-y-2 pt-2">
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
                                    style={{ width: `${slaRate}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                                <span>0%</span>
                                <span>Status Terkini: {slaRate >= 95 ? 'Sangat Baik' : 'Optimal'}</span>
                                <span>100%</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Access Menu Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Akses Cepat Analitik</h3>

                        <div className="space-y-2">
                            <Link
                                href="/admin/analisa"
                                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs transition-colors border border-slate-200/60"
                            >
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="w-4 h-4 text-blue-600" />
                                    <span>Analisa Tren Aduan</span>
                                </div>
                                <ChevronRight className="w-4 h-4 opacity-50" />
                            </Link>

                            <Link
                                href="/admin/analisis-kepuasan"
                                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold text-xs transition-colors border border-slate-200/60"
                            >
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <span>Survei IKM Kepuasan</span>
                                </div>
                                <ChevronRight className="w-4 h-4 opacity-50" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

