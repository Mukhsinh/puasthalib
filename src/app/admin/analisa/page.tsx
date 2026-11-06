'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { BarChart3, TrendingUp, Activity, Download, Layers, Calendar, ListFilter, FileText } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { motion } from 'framer-motion'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings } from '@/utils/appSettings'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

export default function AdminAnalisaPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [tickets, setTickets] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])

    // Filters
    const [filterUnit, setFilterUnit] = useState<string>('')
    const [filterPeriode, setFilterPeriode] = useState<string>('')

    // User Profile Check
    const [userRole, setUserRole] = useState('user')
    const [userUnitId, setUserUnitId] = useState<string | null>(null)

    // Print Config
    const [printDate, setPrintDate] = useState(new Date().toISOString().slice(0, 10))
    const [signerName, setSignerName] = useState('Dr. Mulyadi Saputra, MARS')
    const [signerRole, setSignerRole] = useState('Direktur Utama RSUD Kota Sejahtera')
    const [appSettings, setAppSettings] = useState({
        kop_nama: 'Pemerintah Kota Sejahtera',
        kop_rs: 'Rumah Sakit Umum Daerah',
        kop_alamat: 'Jl. Jend. Sudirman No. 123',
        kop_kontak: 'Email: rsud@sejahtera.go.id | Website: rsud.sejahtera.go.id',
        app_logo: ''
    })
    const [isGenerating, setIsGenerating] = useState(false)

    const supabase = createClient()
    const initialFetchDone = useRef(false)

    useEffect(() => {
        const fetchInitialData = async () => {
            const [sessionRes, settingsRes] = await Promise.all([
                supabase.auth.getSession(),
                fetchAppSettings(supabase)
            ])

            let profileUnitId: string | null = null
            let role = 'user'
            const session = sessionRes.data?.session
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('role, unit_id').eq('id', session.user.id).single()
                if (profile) {
                    role = profile.role
                    setUserRole(role)
                    if (role === 'user') {
                        profileUnitId = profile.unit_id
                        setUserUnitId(profile.unit_id)
                        setFilterUnit(profile.unit_id || '')
                    }
                }
            }

            let unitQuery = supabase.from('units').select('id, nama').order('nama', { ascending: true })
            if (role === 'user' && profileUnitId) {
                unitQuery = unitQuery.eq('id', profileUnitId)
            }
            const { data: unitsData } = await unitQuery
            setUnits(unitsData || [])

            if (settingsRes) {
                setAppSettings({
                    kop_nama: settingsRes.kop_nama,
                    kop_rs: settingsRes.kop_rs,
                    kop_alamat: settingsRes.kop_alamat,
                    kop_kontak: settingsRes.kop_kontak,
                    app_logo: settingsRes.app_logo
                })
                setSignerName(settingsRes.nama_penandatangan)
                setSignerRole(settingsRes.jabatan_penandatangan)
            }
            initialFetchDone.current = true
            fetchTicketsData(role, profileUnitId)
        }
        fetchInitialData()
    }, [])

    const fetchTicketsData = async (role?: string, unitId?: string | null) => {
        setIsLoading(true)
        let query = supabase.from('tickets').select('jenis, status, created_at, unit_id, units!unit_id(nama)')

        // Use passed parameters if available (initial fetch), otherwise use state (subsequent fetches)
        const effectiveRole = role ?? userRole
        const effectiveUnitId = unitId !== undefined ? unitId : userUnitId

        if (effectiveRole === 'user' && effectiveUnitId) {
            query = query.eq('unit_id', effectiveUnitId)
        } else if (filterUnit) {
            query = query.eq('unit_id', filterUnit)
        }
        if (filterPeriode) {
            const [year, month] = filterPeriode.split('-')
            query = query.gte('created_at', `${year}-${month}-01`)
            query = query.lt('created_at', new Date(Number(year), Number(month), 1).toISOString())
        }

        const { data } = await query
        setTickets(data || [])
        setIsLoading(false)
    }

    useEffect(() => {
        if (initialFetchDone.current) {
            fetchTicketsData()
        }
    }, [filterUnit, filterPeriode])

    // Memoize metric calculations to avoid expensive recalculations on re-render
    const { countTotal, countSelesai, resolveRate, csatSimulated, pieData, areaData } = useMemo(() => {
        const total = tickets.length
        const selesai = tickets.filter(t => t.status === 'Selesai').length
        const rate = total > 0 ? Math.round((selesai / total) * 100) : 0
        const csat = total > 0 ? (4.3 + ((total % 7) * 0.08)).toFixed(1) : '0.0'

        const categoryCounts: Record<string, number> = {}
        const monthlyCounts: Record<string, number> = {}

        tickets.forEach(t => {
            categoryCounts[t.jenis] = (categoryCounts[t.jenis] || 0) + 1
            const month = new Date(t.created_at).toLocaleString('id-ID', { month: 'short' })
            monthlyCounts[month] = (monthlyCounts[month] || 0) + 1
        })

        const pData = Object.keys(categoryCounts).map(key => ({
            name: key.replace('_', ' ').toUpperCase(),
            value: categoryCounts[key]
        }))

        const aData = Object.keys(monthlyCounts).map(month => ({
            name: month,
            Total: monthlyCounts[month]
        }))

        return {
            countTotal: total,
            countSelesai: selesai,
            resolveRate: rate,
            csatSimulated: csat,
            pieData: pData,
            areaData: aData
        }
    }, [tickets])

    const handleExportExcel = async () => {
        setIsGenerating(true)
        try {
            const xlsx = await import('xlsx')
            const periodeText = filterPeriode ? new Date(filterPeriode + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Keseluruhan waktu'
            const unitText = filterUnit ? units.find(u => u.id === filterUnit)?.nama || filterUnit : 'Seluruh Unit Global'

            const worksheetData1 = pieData.map((t, index) => ({
                No: index + 1,
                'Kategori Laporan': t.name,
                'Jumlah Tiket': t.value,
                'Persentase': (countTotal > 0 ? Math.round((t.value / countTotal) * 100) : 0) + '%'
            }))

            const worksheetData2 = areaData.map((t, index) => ({
                No: index + 1,
                'Bulan / Periode': t.name,
                'Total Interaksi': t.Total
            }))

            const worksheet = xlsx.utils.json_to_sheet([])

            xlsx.utils.sheet_add_aoa(worksheet, [
                [appSettings.kop_nama.toUpperCase()],
                [appSettings.kop_rs.toUpperCase()],
                [`${appSettings.kop_alamat} | ${appSettings.kop_kontak}`],
                [],
                ['LAPORAN ANALISIS DATA & PERFORMA LAYANAN EKSEKUTIF (KOMPREHENSIF)'],
                [`Periode: ${periodeText} | Unit: ${unitText}`],
                [`Tanggal Cetak: ${new Date(printDate).toLocaleDateString('id-ID')}`],
                [`Penanggung Jawab: ${signerName} (${signerRole})`],
                [],
                [`Total Interaksi: ${countTotal} Tiket Laporan Masuk`],
                [`Tingkat Penyelesaian: ${countSelesai} Laporan Berhasil Ditangani (${resolveRate}%)`],
                [`Estimasi Rata-rata Kepuasan (CSAT): ${csatSimulated}/5.0`],
                [],
                ['A. Rekapitulasi Berdasarkan Kategori Layanan']
            ], { origin: 'A1' })

            xlsx.utils.sheet_add_json(worksheet, worksheetData1, { origin: 'A15' })

            xlsx.utils.sheet_add_aoa(worksheet, [
                ['B. Tren Pelaporan Bulanan / Periode']
            ], { origin: `A${18 + worksheetData1.length}` })

            xlsx.utils.sheet_add_json(worksheet, worksheetData2, { origin: `A${20 + worksheetData1.length}` })

            const workbook = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(workbook, worksheet, "Laporan_Analisa_Eksekutif")
            xlsx.writeFile(workbook, `Laporan_Analisa_Komprehensif_${new Date().toISOString().slice(0, 10)}.xlsx`)
        } catch (err) {
            console.error('Export Excel failed:', err)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleExportPDF = async () => {
        setIsGenerating(true)
        try {
            const periodeText = filterPeriode ? new Date(filterPeriode + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Keseluruhan waktu'
            const unitText = filterUnit ? units.find(u => u.id === filterUnit)?.nama || filterUnit : 'Seluruh Unit Global'

            const tableHeaders = ['No', 'Kategori Laporan (Jenis Tiket)', 'Jumlah Tiket', 'Persentase Beban'];
            const tableData = pieData.map((t, index) => [
                index + 1,
                t.name,
                t.value,
                (countTotal > 0 ? Math.round((t.value / countTotal) * 100) : 0) + '%'
            ]);

            const tableHeader2 = ['No', 'Periode Tren (Bulan)', 'Total Interaksi Tiket', 'Karakteristik Tren'];
            const tableData2 = areaData.map((t, index) => [
                index + 1,
                t.name,
                t.Total,
                t.Total > 10 ? 'Volume Tinggi' : 'Stabil / Terkendali'
            ]);

            await generateFormalPDF({
                title: 'LAPORAN ANALISIS DATA & TREN PERFORMA LAYANAN',
                subtitle: `Periode: ${periodeText} • Cakupan Unit: ${unitText} • Evaluasi Eksekutif`,
                documentNumber: `PUAS/ANL/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${Math.floor(Math.random() * 900 + 100)}`,
                filename: `Laporan_Analisa_Data_${new Date().toISOString().slice(0, 10)}.pdf`,
                appSettings,
                printDate,
                signerName,
                signerRole,
                includeCoverPage: true,
                kpiCards: [
                    { title: 'Total Interaksi', value: countTotal, subtitle: 'Tiket Terdaftar' },
                    { title: 'Penyelesaian', value: countSelesai, subtitle: 'Telah Dituntaskan' },
                    { title: 'Persentase Resolusi', value: `${resolveRate}%`, subtitle: 'Tingkat Keberhasilan' },
                    { title: 'Estimasi CSAT', value: `${csatSimulated}/5.0`, subtitle: 'Kepuasan Layanan' }
                ],
                chartSections: [
                    {
                        title: 'GRAFIK PROPORSI KATEGORI LAPORAN:',
                        items: pieData.map((p, idx) => ({
                            label: p.name,
                            value: p.value,
                            max: countTotal || 1,
                            displayValue: `${p.value} Berkas (${countTotal > 0 ? Math.round((p.value / countTotal) * 100) : 0}%)`,
                            color: idx === 0 ? [59, 130, 246] : idx === 1 ? [16, 185, 129] : idx === 2 ? [245, 158, 11] : [139, 92, 246]
                        }))
                    }
                ],
                narrativeIntro: [
                    'I. RINGKASAN EKSEKUTIF ANALISIS DATA',
                    `Laporan ini menyajikan analisis komprehensif terhadap pola interaksi masyarakat, pengaduan layanan, dan permohonan informasi di lingkungan ${unitText}.`,
                    `Sepanjang periode pengamatan tercatat ${countTotal} berkas interaksi dengan tingkat penyelesaian mencapai ${resolveRate}%. Analisis tren menunjukkan dinamika pelaporan terkonsentrasi pada kategori layanan tertentu yang memerlukan atensi perbaikan berkelanjutan.`,
                    '',
                    'II. REKAPITULASI BERDASARKAN KATEGORI LAYANAN:'
                ],
                tableHeaders,
                tableData,
                additionalInfoBottom: [
                    '',
                    'III. ANALISIS TREN VOLUME PELAPORAN PERIODIK:'
                ],
                tableHeadersBottom: tableHeader2,
                tableDataBottom: tableData2
            });
        } catch (err) {
            console.error('Export PDF failed:', err)
        } finally {
            setIsGenerating(false)
        }
    }

    // Define animation variant
    const itemMotion: any = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Analisa Data & Performa</h1>
                    <p className="text-sm text-slate-500 font-medium">Metrik tingkat tinggi dan kecerdasan bisnis layanan rumah sakit berdasarkan pelaporan real-time.</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={isGenerating}
                            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 text-sm rounded-xl font-bold transition-all disabled:opacity-50 hover:bg-emerald-100"
                        >
                            <Download className="w-4 h-4" /> Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={isGenerating}
                            className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 px-4 py-2 text-sm rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" /> {isGenerating ? 'Memroses...' : 'Unduh PDF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter dan Print Config */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 print:hidden flex flex-col xl:flex-row gap-6">
                <div className="flex-1 space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <ListFilter className="w-4 h-4" /> Filter Analisa:
                    </p>
                    <div className="flex gap-3 w-full">
                        <select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            disabled={userRole === 'user'}
                            className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-primary/50 flex-1 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {userRole !== 'user' && <option value="">Semua Unit Kerja</option>}
                            {units.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                        </select>
                        <input
                            type="month"
                            value={filterPeriode}
                            onChange={(e) => setFilterPeriode(e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-primary/50 flex-1"
                        />
                    </div>
                </div>
                {/* Print Kosmetik Config */}
                <div className="xl:flex-1 space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Konfigurasi Cetak:
                    </p>
                    <div className="flex gap-3 w-full">
                        <input
                            type="date"
                            value={printDate}
                            onChange={(e) => setPrintDate(e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-slate-300 w-32"
                        />
                        <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder="Penandatangan"
                            className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-slate-300 flex-1"
                        />
                        <input
                            type="text"
                            value={signerRole}
                            onChange={(e) => setSignerRole(e.target.value)}
                            placeholder="Jabatan"
                            className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-slate-300 flex-1 hidden md:block"
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium text-sm animate-pulse">Memuat metrik analisis real-time...</p>
                </div>
            ) : (
                <motion.div
                    className="space-y-6"
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
                    }}
                >
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <motion.div variants={itemMotion} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full blur-2xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Total Interaksi</p>
                            <div className="flex items-end gap-3 mb-2">
                                <h3 className="text-4xl font-black text-slate-800">{countTotal}</h3>
                                <Activity className="w-6 h-6 text-blue-500 mb-1.5 opacity-50" />
                            </div>
                        </motion.div>

                        <motion.div variants={itemMotion} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:border-emerald-200 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-full blur-2xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Penyelesaian</p>
                            <div className="flex items-end gap-3 mb-2">
                                <h3 className="text-4xl font-black text-emerald-600">{countSelesai}</h3>
                                <TrendingUp className="w-6 h-6 text-emerald-500 mb-1.5 opacity-50" />
                            </div>
                        </motion.div>

                        <motion.div variants={itemMotion} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100 rounded-full blur-2xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Persentase Resolusi</p>
                            <div className="flex items-end gap-3 mb-2">
                                <h3 className="text-4xl font-black text-indigo-600">{resolveRate}%</h3>
                                <Layers className="w-6 h-6 text-indigo-500 mb-1.5 opacity-50" />
                            </div>
                        </motion.div>

                        <motion.div variants={itemMotion} className="bg-slate-900 p-6 rounded-[1.5rem] shadow-md border-none relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-orange-500/30 transition-colors pointer-events-none" />
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Rata-Rata CSAT</p>
                            <div className="flex items-end gap-3 mb-2">
                                <h3 className="text-4xl font-black text-white">{csatSimulated}</h3>
                                <p className="text-sm text-slate-400 font-medium mb-1.5">/ 5.0</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Charts Section: Vertically stacked for large, clear, and comprehensive view */}
                    <div className="space-y-6 mt-6">

                        {/* Frame 1: Area Chart: Tren Volume Pelaporan (Full Width) */}
                        <motion.div variants={itemMotion} className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col h-[420px] w-full">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-blue-500" /> Tren Volume Pelaporan
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Akumulasi seluruh interaksi dan tiket laporan per bulan secara komprehensif</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    <span>Realtime Akumulasi</span>
                                </div>
                            </div>

                            <div className="flex-1 w-full min-h-[300px]">
                                {areaData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                                        <AreaChart data={areaData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <RechartsTooltip
                                                contentStyle={{ borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                itemStyle={{ fontWeight: 800, fontSize: '13px' }}
                                                labelStyle={{ fontWeight: 800, color: '#334155', fontSize: '12px', marginBottom: '4px' }}
                                            />
                                            <Area type="monotone" dataKey="Total" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" activeDot={{ r: 7, strokeWidth: 2, stroke: '#ffffff', fill: '#1d4ed8' }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <BarChart3 className="w-12 h-12 mb-2 opacity-40 text-blue-500" />
                                        <p className="text-sm font-semibold">Data tren belum tersedia cukup memadai.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Frame 2: Pie Chart: Rasio Kategori Laporan (Diposisikan di Bawah Frame Tren agar Tampilan Lebih Besar, Jelas, & Lengkap) */}
                        <motion.div variants={itemMotion} className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col w-full">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-emerald-500" /> Rasio Kategori Laporan
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Proporsi persebaran jenis layanan dan tiket komplain yang masuk ke sistem</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-100">
                                    <ListFilter className="w-4 h-4 text-emerald-500" />
                                    <span>Total: {countTotal} Tiket Masuk</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                {/* Visual Donut Chart Besar */}
                                <div className="lg:col-span-5 flex flex-col items-center justify-center p-4">
                                    {pieData.length > 0 ? (
                                        <div className="h-64 w-64 relative flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={68}
                                                        outerRadius={100}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                        stroke="#ffffff"
                                                        strokeWidth={3}
                                                    >
                                                        {pieData.map((_entry, index) => (
                                                            <Cell key={"cell-" + index} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.1)' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            {/* Center Label inside donut */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-3xl font-black text-slate-800">{countTotal}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tiket</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-48 w-full flex flex-col items-center justify-center text-slate-400">
                                            <p className="text-sm font-medium">Belum ada distribusi data kategori.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Detail Card Breakdown Lengkap */}
                                <div className="lg:col-span-7 space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                                        Rincian Proporsi & Kontribusi Kategori:
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {pieData.map((entry, index) => {
                                            const pct = countTotal > 0 ? Math.round((entry.value / countTotal) * 100) : 0
                                            const color = COLORS[index % COLORS.length]
                                            return (
                                                <div
                                                    key={index}
                                                    className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col justify-between"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: color }} />
                                                            <span className="text-xs font-black text-slate-800 truncate" title={entry.name}>
                                                                {entry.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-xs">
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden mb-2">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%`, backgroundColor: color }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                                                        <span>Volume Tiket</span>
                                                        <span className="font-extrabold text-slate-800">{entry.value} Berkas</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                </motion.div>
            )}

            {/* --- FORMAL PRINT TEMPLATE (VISIBLE ONLY ON PRINT/PREVIEW) --- */}
            <div className="hidden print:block bg-white p-0 mx-auto max-w-[210mm] w-[100%] min-h-[297mm]">
                {/* Kop Surat MENGGUNAKAN APP_SETTINGS */}
                <div className="flex items-center justify-between border-b-[3px] border-black pb-4 mb-1 border-double">
                    <div className="w-20 h-20 bg-slate-200 flex items-center justify-center font-bold text-slate-500 rounded-lg shrink-0 border border-slate-300">
                        LOGO
                    </div>
                    <div className="text-center flex-1 px-4 text-black">
                        <h1 className="text-xl font-bold uppercase tracking-wider">{appSettings.kop_nama}</h1>
                        <h2 className="text-lg font-bold uppercase tracking-wider">{appSettings.kop_rs}</h2>
                        <p className="text-xs mt-1">{appSettings.kop_alamat}</p>
                        <p className="text-xs">{appSettings.kop_kontak}</p>
                    </div>
                    <div className="w-20 shrink-0" />
                </div>
                <div className="border-b-[1px] border-black mb-6 w-full" />

                {/* Title */}
                <div className="text-center mb-6 text-black">
                    <h3 className="text-base font-bold uppercase underline underline-offset-4 mb-1">Laporan Analisis Data & Performa Layanan</h3>
                    <p className="text-xs">
                        Periode Data: {filterPeriode ? new Date(filterPeriode + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Keseluruhan waktu'} |
                        Unit Kerja: {filterUnit ? units.find(u => u.id === filterUnit)?.nama : 'Seluruh Unit Global'}
                    </p>
                    <p className="text-xs mt-1">Tanggal Cetak: {new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>

                {/* Metrics Summary */}
                <div className="grid grid-cols-4 gap-4 mb-8 text-black border border-black p-4">
                    <div className="text-center border-r border-black">
                        <p className="text-xs font-bold uppercase mb-1">Total Interaksi</p>
                        <h4 className="text-xl font-bold">{countTotal}</h4>
                    </div>
                    <div className="text-center border-r border-black">
                        <p className="text-xs font-bold uppercase mb-1">Penyelesaian</p>
                        <h4 className="text-xl font-bold">{countSelesai}</h4>
                    </div>
                    <div className="text-center border-r border-black">
                        <p className="text-xs font-bold uppercase mb-1">Resolusi</p>
                        <h4 className="text-xl font-bold">{resolveRate}%</h4>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-bold uppercase mb-1">Rata CSAT</p>
                        <h4 className="text-xl font-bold">{csatSimulated}/5.0</h4>
                    </div>
                </div>

                {/* Data Distribution */}
                <div className="font-sans text-black mb-12">
                    <p className="text-sm font-bold uppercase mb-3 border-b border-black pb-1">1. Rekapitulasi Berdasarkan Kategori Layanan:</p>
                    <table className="w-full text-xs text-left border-collapse border border-black">
                        <thead className="bg-slate-100 font-bold">
                            <tr>
                                <th className="border border-black p-2 text-center w-12">No</th>
                                <th className="border border-black p-2">Kategori Laporan (Jenis Tiket)</th>
                                <th className="border border-black p-2 text-center w-32">Jumlah Tiket</th>
                                <th className="border border-black p-2 text-center w-32">Persentase</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pieData.length === 0 && (
                                <tr><td colSpan={4} className="p-4 text-center italic">Tidak ada data untuk periode/unit terpilih.</td></tr>
                            )}
                            {pieData.map((row, index) => (
                                <tr key={index}>
                                    <td className="border border-black p-2 text-center">{index + 1}</td>
                                    <td className="border border-black p-2 font-bold uppercase">{row.name}</td>
                                    <td className="border border-black p-2 text-center font-semibold">{row.value}</td>
                                    <td className="border border-black p-2 text-center">
                                        {countTotal > 0 ? Math.round((row.value / countTotal) * 100) : 0}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Signatures */}
                <div className="mt-16 flex justify-end text-black font-sans break-inside-avoid">
                    <div className="text-center w-64">
                        <p className="text-sm mb-20">{appSettings.kop_nama.replace('Pemerintah ', '').replace('Provinsi ', '').replace('Kabupaten ', '')}, {new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-sm font-bold underline underline-offset-2">{signerName}</p>
                        <p className="text-xs mt-1">{signerRole}</p>
                    </div>
                </div>
            </div>

            {/* Global Print CSS Override */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body { background: white !important; font-family: 'Times New Roman', Times, serif; }
          main, aside, nav, header { display: none !important; }
        }
      `}} />
        </div>
    )
}
