'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    FileText, Download, Calendar, Filter, Activity, Users, Zap,
    Briefcase, Award, BarChart3, ChevronRight, CheckCircle2,
    Layers, Search, ArrowUpRight
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import { motion } from 'framer-motion'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings } from '@/utils/appSettings'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function LaporanEksportPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [dateRange, setDateRange] = useState({ start: '', end: '' })
    const [filterUnit, setFilterUnit] = useState('Semua')
    const [filterJenis, setFilterJenis] = useState('Semua')
    const [ticketData, setTicketData] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])
    const [userRole, setUserRole] = useState('user')
    const [userUnitId, setUserUnitId] = useState<string | null>(null)

    // Print configuration
    const [printDate, setPrintDate] = useState(new Date().toISOString().slice(0, 10))
    const [signerName, setSignerName] = useState('Dr. Mulyadi Saputra, MARS')
    const [signerRole, setSignerRole] = useState('Direktur Utama RSUD Kota Sejahtera')
    const [appSettings, setAppSettings] = useState({
        kop_nama: 'Pemerintah Kota Sejahtera',
        kop_rs: 'Rumah Sakit Umum Daerah',
        kop_alamat: 'Jl. Jend. Sudirman No. 123',
        kop_kontak: 'Email: rsud@sejahtera.go.id | Website: rsud.sejahtera.go.id',
        app_logo: '',
        app_footer_text: ''
    })

    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)

            // Fetch session and app settings concurrently
            const [sessionRes, settings] = await Promise.all([
                supabase.auth.getSession(),
                fetchAppSettings(supabase)
            ])

            let profileUnitId = null
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
                        setFilterUnit(profile.unit_id || 'Semua')
                    }
                }
            }

            // 1. Fetch available units
            let unitQuery = supabase.from('units').select('id, nama').order('nama')
            if (role === 'user' && profileUnitId) {
                unitQuery = unitQuery.eq('id', profileUnitId)
            }

            // 3. Fetch all tickets
            let ticketQuery = supabase.from('tickets').select('*, units!unit_id(nama)').order('created_at', { ascending: false })
            if (role === 'user' && profileUnitId) {
                ticketQuery = ticketQuery.eq('unit_id', profileUnitId)
            }

            const [unitsRes, ticketsRes] = await Promise.all([
                unitQuery,
                ticketQuery
            ])

            if (unitsRes.data) setUnits(unitsRes.data)

            if (settings) {
                setAppSettings({
                    kop_nama: settings.kop_nama,
                    kop_rs: settings.kop_rs,
                    kop_alamat: settings.kop_alamat,
                    kop_kontak: settings.kop_kontak,
                    app_logo: settings.app_logo,
                    app_footer_text: settings.app_footer_text
                })
                setSignerName(settings.nama_penandatangan)
                setSignerRole(settings.jabatan_penandatangan)
            }

            if (ticketsRes.data) {
                const formatted = ticketsRes.data.map((d: any, i: number) => ({
                    id_raw: d.id,
                    no: i + 1,
                    id_tiket: d.tracking_number,
                    tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
                    raw_date: d.created_at,
                    pengirim: d.data_payload?.nama || 'Anonim',
                    kategori: d.jenis ? d.jenis.replace('_', ' ').toUpperCase() : 'LAYANAN',
                    unit: d.units?.nama || 'Global',
                    unit_id: d.unit_id,
                    status: d.status || 'Terkirim',
                    kepuasan: d.data_payload?.ratings ? 'Dinilai' : '-'
                }))
                setTicketData(formatted)
            }

            setIsLoading(false)
        }
        fetchData()
    }, [])

    // FILTER LOGIC - Memoized
    const filteredData = useMemo(() => {
        return ticketData.filter(t => {
            let matchDate = true
            let matchUnit = true
            let matchJenis = true

            if (dateRange.start && dateRange.end) {
                const ticketDate = new Date(t.raw_date).getTime()
                const sDate = new Date(dateRange.start).getTime()
                const eDate = new Date(dateRange.end).getTime() + (24 * 60 * 60 * 1000)
                if (ticketDate < sDate || ticketDate > eDate) matchDate = false
            }

            if (filterUnit !== 'Semua' && t.unit_id !== filterUnit) matchUnit = false
            if (filterJenis !== 'Semua' && t.kategori !== filterJenis) matchJenis = false

            return matchDate && matchUnit && matchJenis
        })
    }, [ticketData, dateRange, filterUnit, filterJenis])

    // METRICS - Memoized
    const { totalCount, selesaiCount, surveiCount, pengaduanCount, resolusiRate, chartData, rankingData } = useMemo(() => {
        const total = filteredData.length
        const selesai = filteredData.filter(d => d.status === 'Selesai').length
        const survei = filteredData.filter(d => d.kategori.includes('SURVEI')).length
        const aduan = filteredData.filter(d => d.kategori.includes('ADUAN') || d.kategori.includes('PENGADUAN')).length
        const rate = total > 0 ? Math.round((selesai / total) * 100) : 0

        // CHART DATA (Kategori)
        const catGroup = filteredData.reduce((acc, curr) => {
            acc[curr.kategori] = (acc[curr.kategori] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        const cData = Object.keys(catGroup).map(k => ({
            name: k,
            total: catGroup[k]
        }))

        // RANKING DATA (Unit Kerja)
        const unitGroup = filteredData.reduce((acc, curr) => {
            acc[curr.unit] = (acc[curr.unit] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        const rData = Object.keys(unitGroup)
            .map(k => ({
                name: k,
                total: unitGroup[k],
                pct: total > 0 ? Math.round((unitGroup[k] / total) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total)

        return {
            totalCount: total,
            selesaiCount: selesai,
            surveiCount: survei,
            pengaduanCount: aduan,
            resolusiRate: rate,
            chartData: cData,
            rankingData: rData
        }
    }, [filteredData])

    // HANDLER EKSPOR EXCEL FORMAL & SANGAT LENGKAP
    const handleExportExcel = async () => {
        setIsGenerating(true)
        try {
            const xlsx = await import('xlsx')
            const worksheet = xlsx.utils.json_to_sheet([])
            const periodeText = dateRange.start ? `${dateRange.start} s/d ${dateRange.end || 'Sekarang'}` : 'Seluruh Riwayat'
            const unitText = filterUnit === 'Semua' ? 'Seluruh Unit Kerja' : units.find(u => u.id === filterUnit)?.nama || filterUnit

            // 1. KOP SURAT FORMAL & INFORMASI RESMI
            xlsx.utils.sheet_add_aoa(worksheet, [
                [appSettings.kop_nama.toUpperCase()],
                [appSettings.kop_rs.toUpperCase()],
                [`${appSettings.kop_alamat} | ${appSettings.kop_kontak}`],
                [],
                ['LAPORAN REKAPITULASI LAYANAN, PENGADUAN, DAN SURVEI (EKSEKUTIF)'],
                [`Periode: ${periodeText} | Unit: ${unitText} | Kategori: ${filterJenis}`],
                [`Tanggal Cetak: ${new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
                [`Penanggung Jawab: ${signerName} (${signerRole})`],
                [],
                ['RINGKASAN METRIK KINERJA LAYANAN:'],
                [`- Total Berkas Interaksi: ${totalCount} Berkas`],
                [`- Tiket Dituntaskan: ${selesaiCount} Berkas (${resolusiRate}%)`],
                [`- Berkas Survei Kepuasan: ${surveiCount} Berkas`],
                [`- Berkas Pengaduan / Keluhan: ${pengaduanCount} Berkas`],
                [],
                ['A. RANKING UNIT KERJA BERDASARKAN VOLUME INTERAKSI / ADUAN']
            ], { origin: 'A1' })

            // 2. Data Ranking Unit Kerja
            const rankingSheetData = rankingData.map((r, i) => ({
                'Peringkat': i + 1,
                'Unit Kerja': r.name,
                'Total Berkas': r.total,
                'Persentase Beban': `${r.pct}%`
            }))
            xlsx.utils.sheet_add_json(worksheet, rankingSheetData, { origin: 'A17' })

            // 3. Data Sebaran Kategori
            const rowAfterRank = 19 + rankingSheetData.length
            xlsx.utils.sheet_add_aoa(worksheet, [
                [],
                ['B. SEBARAN BERDASARKAN KATEGORI LAYANAN']
            ], { origin: `A${rowAfterRank}` })

            const categorySheetData = chartData.map((c, i) => ({
                'No': i + 1,
                'Kategori Layanan': c.name,
                'Total Tiket': c.total,
                'Persentase': (totalCount > 0 ? Math.round((c.total / totalCount) * 100) : 0) + '%'
            }))
            xlsx.utils.sheet_add_json(worksheet, categorySheetData, { origin: `A${rowAfterRank + 2}` })

            // 4. Tabulasi Detail Seluruh Tiket
            const rowAfterCat = rowAfterRank + 4 + categorySheetData.length
            xlsx.utils.sheet_add_aoa(worksheet, [
                [],
                ['C. TABULASI DETAIL SELURUH BERKAS TIKET LAYANAN']
            ], { origin: `A${rowAfterCat}` })

            const worksheetData = filteredData.map(e => ({
                'No': e.no,
                'ID Tiket': e.id_tiket,
                'Tanggal': e.tanggal,
                'Pengirim / Pelapor': e.pengirim,
                'Kategori': e.kategori,
                'Unit Kerja': e.unit,
                'Status Tiket': e.status
            }))
            xlsx.utils.sheet_add_json(worksheet, worksheetData, { origin: `A${rowAfterCat + 2}` })

            // Column Widths
            worksheet['!cols'] = [
                { wch: 6 },
                { wch: 18 },
                { wch: 14 },
                { wch: 25 },
                { wch: 22 },
                { wch: 25 },
                { wch: 16 }
            ]

            const workbook = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(workbook, worksheet, "Laporan_Eksekutif")
            xlsx.writeFile(workbook, `Laporan_Eksekutif_PUAS_${new Date().toISOString().slice(0, 10)}.xlsx`)
        } catch (error) {
            console.error("XLSX export failed:", error)
            alert("Gagal melakukan ekspor.")
        } finally {
            setIsGenerating(false)
        }
    }

    // HANDLER UNDUH PDF FORMAL, KOP & FOOTER, SISTEMATIKA, & GRAFIK
    const handleExportPDF = async () => {
        setIsGenerating(true)
        try {
            const periodeText = dateRange.start ? `${dateRange.start} s/d ${dateRange.end || 'Sekarang'}` : 'Seluruh Riwayat'
            const unitText = filterUnit === 'Semua' ? 'Seluruh Unit Kerja' : units.find(u => u.id === filterUnit)?.nama || filterUnit

            // Ranking Table
            const rankHeaders = ['Peringkat', 'Unit Kerja / Pelayanan', 'Volume Berkas', 'Beban (%)', 'Tingkat Kesiapan']
            const rankTableData = rankingData.map((r, i) => [
                i + 1,
                r.name,
                r.total,
                `${r.pct}%`,
                r.pct > 25 ? 'Prioritas Penanganan' : 'Normal / Stabil'
            ])

            // Category Table
            const catHeaders = ['No', 'Kategori Layanan', 'Jumlah Tiket', 'Proporsi (%)']
            const catTableData = chartData.map((c, i) => [
                i + 1,
                c.name,
                c.total,
                `${totalCount > 0 ? Math.round((c.total / totalCount) * 100) : 0}%`
            ])

            // Detail Table
            const tableHeaders = ['No', 'ID Tiket', 'Tanggal', 'Pengirim / Pelapor', 'Kategori Layanan', 'Unit Kerja', 'Status']
            const pdfTableData = filteredData.slice(0, 40).map((d, index) => [
                index + 1,
                d.id_tiket,
                d.tanggal,
                d.pengirim,
                d.kategori,
                d.unit,
                d.status
            ])

            await generateFormalPDF({
                title: 'LAPORAN REKAPITULASI LAYANAN DAN PERFORMA (EKSEKUTIF)',
                subtitle: `Periode: ${periodeText} • Unit Kerja: ${unitText} • Kategori: ${filterJenis}`,
                documentNumber: `PUAS/LAP/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${Math.floor(Math.random() * 900 + 100)}`,
                filename: `Laporan_Eksekutif_PUAS_${new Date().toISOString().slice(0, 10)}.pdf`,
                appSettings,
                printDate,
                signerName,
                signerRole,
                includeCoverPage: true,
                kpiCards: [
                    { title: 'Total Berkas', value: totalCount, subtitle: 'Aduan & Survei' },
                    { title: 'Tiket Selesai', value: selesaiCount, subtitle: 'Telah Dituntaskan' },
                    { title: 'Persentase Resolusi', value: `${resolusiRate}%`, subtitle: 'Tingkat Penyelesaian' },
                    { title: 'Aduan & Survei', value: `${pengaduanCount} / ${surveiCount}`, subtitle: 'Rasio Pelaporan' }
                ],
                chartSections: [
                    {
                        title: 'GRAFIK RANKING UNIT KERJA TERBANYAK:',
                        items: rankingData.slice(0, 6).map((r, idx) => ({
                            label: r.name,
                            value: r.total,
                            max: totalCount || 1,
                            displayValue: `${r.total} Tiket (${r.pct}%)`,
                            color: idx === 0 ? [239, 68, 68] : idx === 1 ? [245, 158, 11] : idx === 2 ? [59, 130, 246] : [16, 185, 129]
                        }))
                    }
                ],
                narrativeIntro: [
                    'I. DASAR DAN LATAR BELAKANG PELAPORAN',
                    `Laporan eksekutif ini diterbitkan sebagai wujud transparansi dan akuntabilitas penyelenggaraan layanan penanganan keluhan pelanggan, survei kepuasan masyarakat, dan permohonan informasi publik di lingkungan ${appSettings.kop_rs}.`,
                    `Total berkas interaksi yang tercatat dalam periode pelaporan berjumlah ${totalCount} tiket, dengan tingkat efektivitas penyelesaian mencapai ${resolusiRate}%. Unit kerja dengan beban interaksi tertinggi telah diberikan arahan untuk penguatan kapasitas sumber daya.`,
                    '',
                    'II. RANKING UNIT KERJA BERDASARKAN VOLUME TIKET MASUK:'
                ],
                tableHeaders: rankHeaders,
                tableData: rankTableData,
                additionalInfoBottom: [
                    '',
                    'III. REKAPITULASI BERDASARKAN KATEGORI LAYANAN:'
                ],
                tableHeadersBottom: catHeaders,
                tableDataBottom: catTableData,
                sections: [
                    {
                        sectionTitle: 'IV. TABULASI BERKAS TIKET LAYANAN TERBARU:',
                        sectionNote: 'Daftar riwayat 40 tiket interaksi terbaru yang dihimpun dalam periode terpilih:',
                        headers: tableHeaders,
                        data: pdfTableData
                    }
                ]
            })
        } catch (error) {
            console.error("PDF export failed:", error)
        } finally {
            setIsGenerating(false)
        }
    }

    const itemMotion = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 22 } }
    }

    return (
        <div className="w-full space-y-6 relative font-sans">
            {/* Header Title & Tombol Unduh yang Proporsional, Kompak, dan Stylish (Poin 5) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <FileText className="w-8 h-8 text-emerald-600" />
                        Laporan Eksekutif & Rekapitulasi
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">
                        Kompilasi laporan periodik, performa unit kerja, dan ekspor dokumen resmi kedinasan.
                    </p>
                </div>

                {/* Tombol Unduh PDF dan Excel: Ukuran Proporsional & Elegan agar Tidak Overflow (Poin 5) */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <button
                        disabled={isGenerating || isLoading}
                        onClick={handleExportExcel}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-xs hover:shadow-sm disabled:opacity-50"
                        title="Ekspor seluruh data ke Microsoft Excel"
                    >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isGenerating ? 'Memproses...' : 'Ekspor Excel'}</span>
                    </button>

                    <button
                        disabled={isGenerating || isLoading}
                        onClick={handleExportPDF}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md disabled:opacity-50"
                        title="Unduh laporan formal bertandatangan dalam format PDF"
                    >
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isGenerating ? 'Memproses...' : 'Unduh PDF Resmi'}</span>
                    </button>
                </div>
            </div>

            {/* FILTERS & CONTROLS (TATA LETAK ANTI-OVERFLOW) */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/90 print:hidden space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Rentang Waktu */}
                    <div className="md:col-span-4 space-y-1">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" /> Rentang Waktu
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-2.5 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            />
                            <span className="text-slate-400 font-bold text-xs">-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-2.5 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                            />
                        </div>
                    </div>

                    {/* Unit Kerja */}
                    <div className="md:col-span-4 space-y-1">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-emerald-500" /> Filter Unit Kerja
                        </label>
                        <select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            disabled={userRole === 'user'}
                            className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:opacity-60"
                        >
                            {userRole !== 'user' && <option value="Semua">Semua Unit Kerja</option>}
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.nama}</option>
                            ))}
                        </select>
                    </div>

                    {/* Jenis Laporan */}
                    <div className="md:col-span-4 space-y-1">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5 text-amber-500" /> Kategori Layanan
                        </label>
                        <select
                            value={filterJenis}
                            onChange={(e) => setFilterJenis(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500/20 outline-none"
                        >
                            <option value="Semua">Seluruh Kategori</option>
                            <option value="SURVEI">Survei Kepuasan</option>
                            <option value="PENGADUAN LAYANAN">Pengaduan Layanan</option>
                            <option value="PERMINTAAN INFORMASI">Permintaan Informasi</option>
                        </select>
                    </div>
                </div>

                {/* Print Configuration Metadata */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-center text-xs">
                    <span className="font-extrabold text-slate-500 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> Penandatangan:
                    </span>
                    <div className="flex-1 flex flex-wrap gap-2 w-full">
                        <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder="Nama Pejabat"
                            className="px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-xs flex-1 min-w-[150px] outline-none"
                        />
                        <input
                            type="text"
                            value={signerRole}
                            onChange={(e) => setSignerRole(e.target.value)}
                            placeholder="Jabatan"
                            className="px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-xs flex-1 min-w-[150px] outline-none hidden md:block"
                        />
                        <input
                            type="date"
                            value={printDate}
                            onChange={(e) => setPrintDate(e.target.value)}
                            className="px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-xs outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* SCORE CARDS PREVIEW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Berkas</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Activity className="w-4 h-4" />
                        </div>
                    </div>
                    <h4 className="text-3xl font-black text-slate-900">{totalCount}</h4>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Interaksi terfilter</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Tiket Selesai</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <Zap className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-3xl font-black text-emerald-600">{selesaiCount}</h4>
                        <span className="text-xs font-bold text-emerald-500">({resolusiRate}%)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Status tuntas</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Survei Kepuasan</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <h4 className="text-3xl font-black text-slate-900">{surveiCount}</h4>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Responden publik</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Terkait Aduan</span>
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <h4 className="text-3xl font-black text-slate-900">{pengaduanCount}</h4>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Keluhan layanan</p>
                </motion.div>
            </div>

            {/* CHARTS SECTION (POIN 5): FRAME 'RANKING UNIT KERJA TERBANYAK' DIPOSISIKAN BERADA DI ATAS FRAME 'SEBARAN KATEGORI LAYANAN' */}
            <div className="space-y-6 print:hidden">

                {/* 1. FRAME ATAS: RANKING UNIT KERJA TERBANYAK (FULL WIDTH, LEBAR, JELAS, & DETAIL LENGKAP) */}
                <motion.div variants={itemMotion} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                        <div>
                            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                <Award className="w-5 h-5 text-amber-500" /> Ranking Unit Kerja Terbanyak
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 font-semibold">
                                Beban volume laporan dan distribusi aduan yang ditangani masing-masing unit kerja instansi
                            </p>
                        </div>
                        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                            {rankingData.length} Unit Kerja Terdata
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        {/* Horizontal Bar Chart Lebar */}
                        <div className="lg:col-span-7 h-[300px] w-full">
                            {rankingData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                                    <BarChart data={rankingData.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 800, color: '#0f172a' }}
                                        />
                                        <Bar dataKey="total" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={22}>
                                            {rankingData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === 1 ? '#f59e0b' : index === 2 ? '#3b82f6' : '#10b981'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                                    Belum ada data unit kerja.
                                </div>
                            )}
                        </div>

                        {/* Top Ranking Badges & Detail Breakdown */}
                        <div className="lg:col-span-5 space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                                Top 5 Unit Kerja Tertinggi:
                            </h4>
                            <div className="space-y-2">
                                {rankingData.slice(0, 5).map((unit, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${idx === 0
                                                ? 'bg-amber-400 text-amber-950 shadow-xs'
                                                : idx === 1
                                                    ? 'bg-slate-300 text-slate-800'
                                                    : idx === 2
                                                        ? 'bg-amber-700/20 text-amber-800'
                                                        : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {idx + 1}
                                            </div>
                                            <span className="text-xs font-bold text-slate-900 truncate">{unit.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-black text-slate-900">{unit.total} Tiket</span>
                                            <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200/70">
                                                {unit.pct}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. FRAME BAWAH: SEBARAN KATEGORI LAYANAN */}
                <motion.div variants={itemMotion} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                        <div>
                            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-blue-600" /> Sebaran Kategori Layanan
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 font-semibold">
                                Perbandingan volume berdasarkan jenis pelaporan yang masuk ke sistem
                            </p>
                        </div>
                        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                            Total: {totalCount} Laporan
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        <div className="lg:col-span-8 h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: -10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} interval={0} height={40} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={36}>
                                        {chartData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="lg:col-span-4 space-y-2.5">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                                Proporsi Berdasarkan Kategori:
                            </h4>
                            {chartData.map((cat, idx) => {
                                const pct = totalCount > 0 ? Math.round((cat.total / totalCount) * 100) : 0
                                return (
                                    <div key={idx} className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                            <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-black text-slate-900">{cat.total}</span>
                                            <span className="text-[10px] font-bold text-slate-400">({pct}%)</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* TABULAR PREVIEW (ANTI-OVERFLOW) */}
            <motion.div variants={itemMotion} className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden print:hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-slate-900 text-lg">Pratinjau Berkas Rekapitulasi</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-1">
                            Daftar riwayat tiket terfilter yang siap dicetak ke dokumen resmi PDF atau diekspor ke Excel.
                        </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                        {filteredData.length} Berkas
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-100 font-black tracking-wider">
                            <tr>
                                <th className="px-5 py-3.5 whitespace-nowrap">Tanggal</th>
                                <th className="px-5 py-3.5 whitespace-nowrap">ID Tiket</th>
                                <th className="px-5 py-3.5">Pelapor</th>
                                <th className="px-5 py-3.5">Kategori</th>
                                <th className="px-5 py-3.5">Unit Kerja</th>
                                <th className="px-5 py-3.5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-bold">
                                        Tidak ada berkas yang cocok dengan filter yang dipilih.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.slice(0, 50).map((row) => (
                                    <tr key={row.no} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-3 font-semibold text-slate-600 whitespace-nowrap">{row.tanggal}</td>
                                        <td className="px-5 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">{row.id_tiket}</td>
                                        <td className="px-5 py-3 font-bold text-slate-800">{row.pengirim}</td>
                                        <td className="px-5 py-3">
                                            <span className="inline-block px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                                                {row.kategori}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-slate-700">{row.unit}</td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider ${row.status === 'Selesai'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    )
}
