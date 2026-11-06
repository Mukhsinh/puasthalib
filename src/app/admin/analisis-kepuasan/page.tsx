'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    FileText, Download, TrendingUp, Users, Star, Award, Heart,
    MessageSquare, Briefcase, Activity, CheckCircle2, Layers,
    PieChart as PieIcon, ShieldCheck, Gauge
} from 'lucide-react'
import * as xlsx from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings } from '@/utils/appSettings'
import SpeedometerGauge from '@/components/SpeedometerGauge'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'

// -- 11 INDIKATOR STANDAR REGULASI PERMENPAN RB NO. 14 TAHUN 2017 --
const SURVEY_QUESTIONS = [
    { id: 'q1', title: 'Persyaratan Pelayanan' },
    { id: 'q2', title: 'Kemudahan Prosedur' },
    { id: 'q3', title: 'Kecepatan Waktu' },
    { id: 'q4', title: 'Kewajaran Biaya / Tarif' },
    { id: 'q5', title: 'Kesesuaian Produk' },
    { id: 'q6', title: 'Kompetensi Petugas' },
    { id: 'q7', title: 'Perilaku & Kesopanan' },
    { id: 'q8', title: 'Sarana & Prasarana' },
    { id: 'q9', title: 'Penanganan Pengaduan' },
    { id: 'q10', title: 'Transparansi Layanan' },
    { id: 'q11', title: 'Integritas Petugas' }
]

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function AnalisisKepuasanPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [rankingFilter, setRankingFilter] = useState<'all' | 'top10' | 'bottom10'>('all')
    const [rawSurveys, setRawSurveys] = useState<any[]>([])
    const [allTickets, setAllTickets] = useState<any[]>([])

    // Print & KOP Configuration
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
        const fetchInitialData = async () => {
            setIsLoading(true)

            // 1. Fetch App Settings
            const settings = await fetchAppSettings(supabase)
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

            // 2. Profile Check
            const { data: { session } } = await supabase.auth.getSession()
            let profileUnitId: string | null = null
            let role = 'user'
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('role, unit_id').eq('id', session.user.id).single()
                if (profile) {
                    role = profile.role
                    if (role === 'user') {
                        profileUnitId = profile.unit_id
                    }
                }
            }

            // 3. Fetch All Tickets for Operational KPIs (Total Interaksi, Penyelesaian, Resolusi)
            let allTicketsQuery = supabase.from('tickets').select('id, jenis, status, unit_id, created_at')
            if (role === 'user' && profileUnitId) {
                allTicketsQuery = allTicketsQuery.eq('unit_id', profileUnitId)
            }
            const { data: ticketsData } = await allTicketsQuery
            setAllTickets(ticketsData || [])

            // 4. Fetch Surveys with detailed payload
            let surveyQuery = supabase.from('tickets')
                .select('*, units!unit_id(nama)')
                .eq('jenis', 'survei')
                .order('created_at', { ascending: false })

            if (role === 'user' && profileUnitId) {
                surveyQuery = surveyQuery.eq('unit_id', profileUnitId)
            }
            const { data: surveyData } = await surveyQuery
            setRawSurveys(surveyData || [])

            setIsLoading(false)
        }
        fetchInitialData()
    }, [])

    // --- KALKULASI METRIK OPERASIONAL (TOTAL INTERAKSI, PENYELESAIAN, PERSENTASE RESOLUSI) ---
    const totalInteraksi = allTickets.length > 0 ? allTickets.length : rawSurveys.length
    const totalSelesai = allTickets.filter(t => t.status === 'Selesai').length
    const persentaseResolusi = totalInteraksi > 0
        ? Math.round((totalSelesai / totalInteraksi) * 100)
        : (rawSurveys.length > 0 ? 100 : 0)

    // --- KALKULASI METRIK SURVEI & KAIDAH PERMENPAN RB NO. 14 TAHUN 2017 ---
    const totalRespondents = rawSurveys.length

    let totalScoreSum = 0
    let totalQuestionsAnswered = 0
    const questionScores = SURVEY_QUESTIONS.map(q => ({ id: q.id, name: q.title, total: 0, count: 0 }))

    const pekerjaanCount: Record<string, number> = {}
    const umurCount: Record<string, number> = {}
    const unitScores: Record<string, { total: number, count: number }> = {}

    const tableData = rawSurveys.map((s, index) => {
        const payload = s.data_payload || {}
        let avgRating = 0

        if (payload.ratings) {
            const scores = Object.values(payload.ratings) as number[]
            if (scores.length > 0) {
                const sum = scores.reduce((a, b) => a + b, 0)
                avgRating = sum / scores.length
                totalScoreSum += sum
                totalQuestionsAnswered += scores.length
            }

            // Agregasi per unsur
            SURVEY_QUESTIONS.forEach((q, i) => {
                if (payload.ratings[q.id]) {
                    questionScores[i].total += payload.ratings[q.id]
                    questionScores[i].count += 1
                }
            })
        }

        const job = payload.pekerjaan || 'Lainnya'
        pekerjaanCount[job] = (pekerjaanCount[job] || 0) + 1

        const age = payload.umur || 'Tidak Diketahui'
        umurCount[age] = (umurCount[age] || 0) + 1

        const unitName = s.units?.nama || 'Unit Pelayanan'

        if (avgRating > 0) {
            if (!unitScores[unitName]) unitScores[unitName] = { total: 0, count: 0 }
            unitScores[unitName].total += avgRating
            unitScores[unitName].count += 1
        }

        return {
            no: index + 1,
            id: s.tracking_number,
            tanggal: new Date(s.created_at).toLocaleDateString('id-ID'),
            nama: payload.nama || 'Anonim',
            umur: age,
            pekerjaan: job,
            unit: unitName,
            skor: avgRating.toFixed(2),
            feedback: payload.feedback || '-'
        }
    })

    // Indeks IKM Skala 1 - 4
    const ikmIndex = totalQuestionsAnswered > 0 ? totalScoreSum / totalQuestionsAnswered : 0
    const globalAvg = ikmIndex.toFixed(2)

    // Nilai Konversi IKM Skala 25 - 100 (Indeks IKM x 25 sesuai Permenpan RB)
    const ikmKonversi = Number((ikmIndex * 25).toFixed(2))

    // Rata-rata CSAT Skala 5.0: (Indeks IKM / 4) * 5.0
    const csatAvg = ikmIndex > 0 ? ((ikmIndex / 4) * 5.0).toFixed(2) : '0.00'

    // Predikat Mutu Sesuai Permenpan RB No. 14 Tahun 2017:
    // 88.31 - 100.00 : Sangat Baik (A)
    // 76.61 - 88.30 : Baik (B)
    // 65.00 - 76.60 : Kurang Baik (C)
    // 25.00 - 64.99 : Tidak Baik (D)
    let predikatMutu = 'Tidak Baik'
    let predikatGrade = 'D'
    let predikatColor = 'text-rose-600 bg-rose-50 border-rose-200'

    if (ikmKonversi >= 88.31) {
        predikatMutu = 'Sangat Baik'
        predikatGrade = 'A'
        predikatColor = 'text-emerald-700 bg-emerald-50 border-emerald-300'
    } else if (ikmKonversi >= 76.61) {
        predikatMutu = 'Baik'
        predikatGrade = 'B'
        predikatColor = 'text-blue-700 bg-blue-50 border-blue-300'
    } else if (ikmKonversi >= 65.00) {
        predikatMutu = 'Kurang Baik'
        predikatGrade = 'C'
        predikatColor = 'text-amber-700 bg-amber-50 border-amber-300'
    }

    // Chart Data untuk 11 Unsur
    const barChartData = questionScores.map(q => {
        const skor = q.count > 0 ? Number((q.total / q.count).toFixed(2)) : 0
        const konversi = Number((skor * 25).toFixed(1))
        return {
            id: q.id,
            name: q.name,
            skor: skor,
            konversi: konversi,
            mutu: konversi >= 88.31 ? 'A' : konversi >= 76.61 ? 'B' : konversi >= 65 ? 'C' : 'D'
        }
    })

    // Pie Chart Data Demografi Pekerjaan
    const pieChartData = Object.keys(pekerjaanCount).map(key => ({
        name: key,
        value: pekerjaanCount[key]
    }))

    // Data Demografi Umur
    const umurChartData = Object.keys(umurCount).map(key => ({
        name: key,
        value: umurCount[key]
    }))

    // Ranking Unit Kerja
    let unitRankingData = Object.keys(unitScores).map(name => ({
        name,
        count: unitScores[name].count,
        skor: unitScores[name].count > 0 ? Number((unitScores[name].total / unitScores[name].count).toFixed(2)) : 0,
        konversi: unitScores[name].count > 0 ? Number(((unitScores[name].total / unitScores[name].count) * 25).toFixed(1)) : 0
    })).sort((a, b) => b.skor - a.skor)

    if (rankingFilter === 'top10') {
        unitRankingData = unitRankingData.slice(0, 10)
    } else if (rankingFilter === 'bottom10') {
        unitRankingData = unitRankingData.slice(-10).reverse()
    }

    // --- HANDLER EXCEL FORMAL DENGAN KOP & DETAIL LENGKAP ---
    const handleExportExcel = () => {
        setIsGenerating(true)
        setTimeout(() => {
            try {
                const worksheet = xlsx.utils.json_to_sheet([])

                // 1. KOP SURAT FORMAL & METADATA RESMI
                xlsx.utils.sheet_add_aoa(worksheet, [
                    [appSettings.kop_nama.toUpperCase()],
                    [appSettings.kop_rs.toUpperCase()],
                    [`${appSettings.kop_alamat} | ${appSettings.kop_kontak}`],
                    [],
                    ['LAPORAN HASIL EVALUASI SURVEI KEPUASAN MASYARAKAT (IKM)'],
                    ['BERDASARKAN PERMENPAN RB NO. 14 TAHUN 2017'],
                    [`Tanggal Cetak: ${new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
                    [`Penanggung Jawab / Pejabat: ${signerName} (${signerRole})`],
                    [],
                    ['RINGKASAN INDIKATOR KUNCI (KEY PERFORMANCE INDICATORS):'],
                    [`- Total Interaksi Tiket Layanan: ${totalInteraksi} Berkas`],
                    [`- Laporan / Aduan Berhasil Diselesaikan: ${totalSelesai} Berkas`],
                    [`- Persentase Resolusi Pelayanan: ${persentaseResolusi}%`],
                    [`- Total Responden Survei Kepuasan: ${totalRespondents} Orang`],
                    [`- Indeks Kepuasan Masyarakat (IKM): ${globalAvg} / 4.00`],
                    [`- Nilai Konversi IKM: ${ikmKonversi} / 100.00`],
                    [`- Mutu Pelayanan: Mutu ${predikatGrade} (${predikatMutu.toUpperCase()})`],
                    [`- Estimasi Rata-Rata CSAT: ${csatAvg} / 5.00`],
                    [],
                    ['A. REKAPITULASI 11 UNSUR PELAYANAN (PERMENPAN RB NO. 14/2017)']
                ], { origin: 'A1' })

                // 2. Data Unsur Pelayanan
                const unsurSheetData = barChartData.map((u, i) => ({
                    'No': i + 1,
                    'Unsur Penilaian': u.name,
                    'Skor Rata-Rata (1-4)': u.skor,
                    'Nilai Konversi (25-100)': u.konversi,
                    'Mutu Pelayanan': `Mutu ${u.mutu}`,
                    'Predikat': u.mutu === 'A' ? 'Sangat Baik' : u.mutu === 'B' ? 'Baik' : u.mutu === 'C' ? 'Kurang Baik' : 'Tidak Baik'
                }))
                xlsx.utils.sheet_add_json(worksheet, unsurSheetData, { origin: 'A21' })

                // 3. Data Peringkat Unit Kerja
                const rowAfterUnsur = 23 + unsurSheetData.length
                xlsx.utils.sheet_add_aoa(worksheet, [
                    [],
                    ['B. EVALUASI KEPUASAN BERDASARKAN UNIT KERJA']
                ], { origin: `A${rowAfterUnsur}` })

                const unitSheetData = unitRankingData.map((u, i) => ({
                    'Peringkat': i + 1,
                    'Unit Pelayanan': u.name,
                    'Total Responden': u.count,
                    'Indeks IKM (1-4)': u.skor,
                    'Nilai Konversi': u.konversi,
                    'Kategori Mutu': u.konversi >= 88.31 ? 'A (Sangat Baik)' : u.konversi >= 76.61 ? 'B (Baik)' : u.konversi >= 65 ? 'C (Kurang)' : 'D (Buruk)'
                }))
                xlsx.utils.sheet_add_json(worksheet, unitSheetData, { origin: `A${rowAfterUnsur + 2}` })

                // 4. Tabulasi Detail Responden
                const rowAfterUnit = rowAfterUnsur + 4 + unitSheetData.length
                xlsx.utils.sheet_add_aoa(worksheet, [
                    [],
                    ['C. TABULASI DETAIL RESPONDEN DAN SARAN MASUKAN']
                ], { origin: `A${rowAfterUnit}` })

                const detailSheetData = tableData.map(t => ({
                    'No': t.no,
                    'ID Tiket Survei': t.id,
                    'Tanggal Pengisian': t.tanggal,
                    'Nama Responden': t.nama,
                    'Rentang Umur': t.umur,
                    'Pekerjaan': t.pekerjaan,
                    'Unit Layanan': t.unit,
                    'Skor Rata-Rata': t.skor,
                    'Saran & Masukan Pelayanan': t.feedback
                }))
                xlsx.utils.sheet_add_json(worksheet, detailSheetData, { origin: `A${rowAfterUnit + 2}` })

                // Autofit column width
                worksheet['!cols'] = [
                    { wch: 6 },
                    { wch: 30 },
                    { wch: 20 },
                    { wch: 22 },
                    { wch: 18 },
                    { wch: 20 },
                    { wch: 25 },
                    { wch: 15 },
                    { wch: 45 },
                ]

                const workbook = xlsx.utils.book_new()
                xlsx.utils.book_append_sheet(workbook, worksheet, "Laporan_IKM_Formal")
                xlsx.writeFile(workbook, `Laporan_IKM_Formal_${new Date().toISOString().slice(0, 10)}.xlsx`)
            } catch (err) {
                console.error('Export error:', err)
                alert('Gagal mengekspor data.')
            }
            setIsGenerating(false)
        }, 800)
    }

    // --- HANDLER PDF FORMAL DENGAN KOP, GRAFIK VISUAL, SISTEMATIKA LENGKAP ---
    const handleExportPDF = () => {
        setIsGenerating(true)
        setTimeout(() => {
            // Unsur Penilaian Table
            const unsurHeaders = ['No', 'Unsur Pelayanan (Permenpan RB)', 'Indeks (1-4)', 'Konversi (100)', 'Mutu', 'Kategori']
            const unsurRows = barChartData.map((u, i) => [
                i + 1,
                u.name,
                u.skor.toFixed(2),
                u.konversi.toFixed(1),
                `Mutu ${u.mutu}`,
                u.mutu === 'A' ? 'Sangat Baik' : u.mutu === 'B' ? 'Baik' : u.mutu === 'C' ? 'Kurang Baik' : 'Tidak Baik'
            ])

            // Ranking Unit Kerja Table
            const rankHeaders = ['Peringkat', 'Unit Layanan', 'Responden', 'Indeks IKM', 'Konversi', 'Predikat']
            const rankRows = unitRankingData.map((u, i) => [
                i + 1,
                u.name,
                u.count,
                `${u.skor.toFixed(2)}/4.00`,
                u.konversi.toFixed(1),
                u.konversi >= 88.31 ? 'A (Sangat Baik)' : u.konversi >= 76.61 ? 'B (Baik)' : u.konversi >= 65 ? 'C (Kurang)' : 'D (Buruk)'
            ])

            // Tabulasi Responden
            const respHeaders = ['No', 'Tgl / ID', 'Responden (Pekerjaan)', 'Unit Kerja', 'Skor', 'Saran Masukan']
            const respRows = tableData.slice(0, 35).map(t => [
                t.no,
                `${t.tanggal}\n${t.id}`,
                `${t.nama}\n(${t.pekerjaan}, ${t.umur})`,
                t.unit,
                `${t.skor}/4.0`,
                t.feedback
            ])

            generateFormalPDF({
                title: 'LAPORAN HASIL EVALUASI SURVEI KEPUASAN MASYARAKAT (IKM)',
                subtitle: `Pedoman Permenpan RB No. 14 Tahun 2017 • Evaluasi Real-Time Terintegrasi`,
                documentNumber: `PUAS/IKM/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${Math.floor(Math.random() * 900 + 100)}`,
                filename: `Laporan_IKM_Formal_${new Date().toISOString().slice(0, 10)}.pdf`,
                appSettings,
                printDate,
                signerName,
                signerRole,
                includeCoverPage: true,
                kpiCards: [
                    { title: 'Total Interaksi', value: totalInteraksi, subtitle: 'Tiket & Responden' },
                    { title: 'Penyelesaian', value: totalSelesai, subtitle: 'Berkas Dituntaskan' },
                    { title: 'Resolusi', value: `${persentaseResolusi}%`, subtitle: 'Tingkat Penanganan' },
                    { title: 'Skor IKM', value: `${ikmKonversi}`, subtitle: `Mutu ${predikatGrade} (${globalAvg}/4.0)` },
                ],
                chartSections: [
                    {
                        title: 'GRAFIK VISUALISASI CAPAIAN NILAI KONVERSI PER UNSUR (IKM):',
                        items: barChartData.map((u) => ({
                            label: u.name,
                            value: u.konversi,
                            max: 100,
                            displayValue: `${u.konversi} (Mutu ${u.mutu})`,
                            color: u.mutu === 'A' ? [16, 185, 129] : u.mutu === 'B' ? [59, 130, 246] : u.mutu === 'C' ? [245, 158, 11] : [239, 68, 68]
                        }))
                    }
                ],
                narrativeIntro: [
                    'I. RINGKASAN EKSEKUTIF PELAYANAN & KEPUASAN PUBLIK',
                    `Laporan evaluasi ini disusun berdasarkan akumulasi data survei kepuasan masyarakat terhadap unit-unit pelayanan publik di ${appSettings.kop_rs}.`,
                    `Berdasarkan data yang terhimpun dari ${totalRespondents} responden, diperoleh Nilai Konversi IKM sebesar ${ikmKonversi} dari skala 100 (Indeks ${globalAvg} dari skala 4.00). Kinerja pelayanan publik ini dikategorikan dengan Predikat Mutu "${predikatMutu.toUpperCase()}" (Mutu ${predikatGrade}).`,
                    '',
                    'II. ANALISIS 11 UNSUR PELAYANAN (PERMENPAN RB NO. 14 TAHUN 2017):'
                ],
                tableHeaders: unsurHeaders,
                tableData: unsurRows,
                additionalInfoBottom: [
                    '',
                    'III. EVALUASI TINGKAT KEPUASAN BERDASARKAN UNIT KERJA:'
                ],
                tableHeadersBottom: rankHeaders,
                tableDataBottom: rankRows,
                sections: [
                    {
                        sectionTitle: 'IV. TABULASI RESPONDEN DAN UMPAN BALIK PUBLIK:',
                        sectionNote: 'Daftar riwayat responden survei dan saran perbaikan layanan terbaru:',
                        headers: respHeaders,
                        data: respRows
                    }
                ]
            })

            setIsGenerating(false)
        }, 500)
    }

    const itemMotion = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 22 } }
    }

    return (
        <div className="w-full space-y-6 relative font-sans">
            {/* Header Title & Stylish Compact Action Buttons */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Heart className="w-8 h-8 text-rose-500 fill-rose-500/20" />
                        Analisis Kepuasan & IKM
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-semibold">
                        Dashboard Analitik Indeks Kepuasan Masyarakat Permenpan RB No. 14/2017 dan Performa Operasional Realtime.
                    </p>
                </div>

                {/* Stylish & Compact Download Buttons (Poin 8) */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <button
                        onClick={handleExportExcel}
                        disabled={isGenerating || isLoading}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-xs hover:shadow-sm disabled:opacity-50"
                        title="Unduh laporan formal dalam format Microsoft Excel"
                    >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isGenerating ? 'Memroses...' : 'Ekspor Excel'}</span>
                    </button>

                    <button
                        onClick={handleExportPDF}
                        disabled={isGenerating || isLoading}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md disabled:opacity-50"
                        title="Unduh laporan formal bertandatangan dalam format PDF"
                    >
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{isGenerating ? 'Memroses...' : 'Unduh PDF Resmi'}</span>
                    </button>
                </div>
            </div>

            {/* Print & Signature Config Bar */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 print:hidden flex flex-col md:flex-row gap-3 items-center text-xs">
                <div className="font-extrabold text-slate-600 flex items-center gap-1.5 shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Konfigurasi Lembar Dokumen:</span>
                </div>
                <div className="flex-1 flex flex-wrap gap-2.5 w-full">
                    <input
                        type="date"
                        value={printDate}
                        onChange={(e) => setPrintDate(e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-500/30 text-xs"
                    />
                    <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Nama Penandatangan"
                        className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-500/30 text-xs flex-1 min-w-[160px]"
                    />
                    <input
                        type="text"
                        value={signerRole}
                        onChange={(e) => setSignerRole(e.target.value)}
                        placeholder="Jabatan Penandatangan"
                        className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-blue-500/30 text-xs flex-1 min-w-[180px] hidden sm:block"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-3">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold text-xs animate-pulse">Menghitung metrik kepuasan dan IKM dari database...</p>
                </div>
            ) : (
                <motion.div
                    className="space-y-6"
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
                    }}
                >
                    {/* 1. KARTU-KARTU KPI UTAMA (POIN 7): Total Interaksi, Penyelesaian, Persentase Resolusi, Rata-Rata CSAT */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1: Total Interaksi */}
                        <motion.div variants={itemMotion} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-blue-300 transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Interaksi</span>
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <Activity className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-slate-900">{totalInteraksi}</h3>
                                <span className="text-xs font-bold text-slate-400">Berkas</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">Akumulasi aduan, survei, dan layanan</p>
                        </motion.div>

                        {/* 2: Penyelesaian */}
                        <motion.div variants={itemMotion} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-emerald-300 transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Penyelesaian</span>
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-emerald-600">{totalSelesai}</h3>
                                <span className="text-xs font-bold text-emerald-500">Tuntas</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">Laporan status verifikasi selesai</p>
                        </motion.div>

                        {/* 3: Persentase Resolusi */}
                        <motion.div variants={itemMotion} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Persentase Resolusi</span>
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                    <Layers className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-indigo-600">{persentaseResolusi}%</h3>
                                <span className="text-xs font-bold text-slate-400">Tingkat Penanganan</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full transition-all duration-700" style={{ width: `${persentaseResolusi}%` }} />
                            </div>
                        </motion.div>

                        {/* 4: Rata-Rata CSAT */}
                        <motion.div variants={itemMotion} className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />
                            <div className="flex items-center justify-between mb-2 relative">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">Rata-Rata CSAT</span>
                                <div className="w-8 h-8 rounded-xl bg-white/10 text-rose-400 flex items-center justify-center font-bold">
                                    <Star className="w-4 h-4 fill-rose-400" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 relative">
                                <h3 className="text-3xl font-black text-white">{csatAvg}</h3>
                                <span className="text-xs font-bold text-slate-400">/ 5.00</span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-1 font-medium relative">Customer Satisfaction Index</p>
                        </motion.div>
                    </div>

                    {/* SPEEDOMETER GAUGE DASHBOARD: SKOR IKM GLOBAL & PREDIKAT MUTU (POIN 4 & 7) */}
                    <motion.div variants={itemMotion} className="bg-gradient-to-br from-white to-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200/90 shadow-sm relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-amber-500" />
                                    <h3 className="font-black text-slate-900 text-lg">Evaluasi Indeks Kepuasan Masyarakat (IKM Global)</h3>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 font-medium">
                                    Standarisasi Perhitungan Permenpan RB No. 14 Tahun 2017 (Skala 25 - 100 dan Skala Indeks 1 - 4)
                                </p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border bg-white text-slate-700 border-slate-200 shadow-2xs">
                                {totalRespondents} Responden Terverifikasi
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                            {/* Speedometer Gauge Utama (IKM Konversi 25 - 100) */}
                            <div className="md:col-span-5 flex flex-col items-center justify-center p-2 bg-white rounded-2xl border border-slate-100 shadow-xs">
                                <SpeedometerGauge
                                    value={ikmKonversi}
                                    min={25}
                                    max={100}
                                    size={230}
                                    title="Gauge Indeks IKM Nasional"
                                    subtitle="Skala Konversi 25 - 100"
                                    unit="Poin"
                                    gradeLabel={`Mutu ${predikatGrade} • ${predikatMutu}`}
                                />
                            </div>

                            {/* Detail Breakdown IKM & Predikat Mutu Sesuai Database */}
                            <div className="md:col-span-7 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Skor IKM Global (Indeks)</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-slate-900">{globalAvg}</span>
                                            <span className="text-xs font-bold text-slate-400">/ 4.00</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Nilai Persepsi Rata-Rata Unsur</p>
                                    </div>

                                    <div className={`p-4 rounded-2xl border shadow-2xs ${predikatColor}`}>
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-75 mb-1">Predikat Mutu Pelayanan</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black">Mutu {predikatGrade}</span>
                                        </div>
                                        <p className="text-xs font-black mt-1 uppercase tracking-wide">{predikatMutu}</p>
                                    </div>
                                </div>

                                {/* Kaidah Interval Mutu Permenpan RB */}
                                <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/70 text-xs space-y-2">
                                    <p className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider">
                                        Kaidah Klasifikasi Mutu Pelayanan (Permenpan RB 14/2017):
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold">
                                        <div className={`p-2 rounded-xl border text-center ${ikmKonversi >= 88.31 ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/30' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                            <p className="font-black text-xs">Mutu A</p>
                                            <p className="text-[9px]">88.31 - 100.00</p>
                                            <p className="text-[9px] uppercase font-extrabold">Sangat Baik</p>
                                        </div>
                                        <div className={`p-2 rounded-xl border text-center ${ikmKonversi >= 76.61 && ikmKonversi < 88.31 ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-500/30' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                            <p className="font-black text-xs">Mutu B</p>
                                            <p className="text-[9px]">76.61 - 88.30</p>
                                            <p className="text-[9px] uppercase font-extrabold">Baik</p>
                                        </div>
                                        <div className={`p-2 rounded-xl border text-center ${ikmKonversi >= 65.00 && ikmKonversi < 76.61 ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/30' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                            <p className="font-black text-xs">Mutu C</p>
                                            <p className="text-[9px]">65.00 - 76.60</p>
                                            <p className="text-[9px] uppercase font-extrabold">Kurang Baik</p>
                                        </div>
                                        <div className={`p-2 rounded-xl border text-center ${ikmKonversi < 65.00 ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500/30' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                            <p className="font-black text-xs">Mutu D</p>
                                            <p className="text-[9px]">25.00 - 64.99</p>
                                            <p className="text-[9px] uppercase font-extrabold">Tidak Baik</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* FRAME 1 (POIN 4): DEMOGRAFI RESPONDEN BERADA DI ATAS FRAME UNSUR PELAYANAN SEHINGGA TAMPIL LEBAR, JELAS, DAN DETAIL */}
                    <motion.div variants={itemMotion} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 w-full">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-indigo-600" /> Demografi Responden Lengkap
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 font-semibold">
                                    Distribusi profil masyarakat pengguna layanan berdasarkan profesi, rentang umur, dan representasi publik
                                </p>
                            </div>
                            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                                Total: {totalRespondents} Responden
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            {/* Donut Chart Pekerjaan */}
                            <div className="lg:col-span-5 flex flex-col items-center justify-center p-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Sebaran Profesi / Pekerjaan</h4>
                                {pieChartData.length > 0 ? (
                                    <div className="h-60 w-60 relative flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieChartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={88}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    stroke="#ffffff"
                                                    strokeWidth={2}
                                                >
                                                    {pieChartData.map((_entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip
                                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.1)' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-2xl font-black text-slate-800">{totalRespondents}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Orang</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 text-xs py-8 font-medium">Belum ada data demografi.</div>
                                )}
                            </div>

                            {/* Breakdown List Proporsi Profesi & Rentang Umur */}
                            <div className="lg:col-span-7 space-y-4">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
                                        Proporsi Berdasarkan Kategori Pekerjaan:
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {pieChartData.map((item, idx) => {
                                            const pct = totalRespondents > 0 ? Math.round((item.value / totalRespondents) * 100) : 0
                                            const col = COLORS[idx % COLORS.length]
                                            return (
                                                <div key={idx} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                                                        <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                        <span className="text-xs font-black text-slate-900">{item.value}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">({pct}%)</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {umurChartData.length > 0 && (
                                    <div className="pt-2 border-t border-slate-100">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                                            Kelompok Usia Responden:
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {umurChartData.map((u, i) => (
                                                <div key={i} className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-200/80 flex items-center gap-1.5">
                                                    <span className="text-slate-500">{u.name}:</span>
                                                    <span className="font-black text-indigo-600">{u.value} Orang</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* FRAME 2 (POIN 4 & POIN 8): RATA-RATA SKOR PER UNSUR PELAYANAN DENGAN GRAFIK MODEL SPEEDOMETER / GAUGE CAPAIAN INDIKATOR */}
                    <motion.div variants={itemMotion} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 w-full">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-indigo-600" /> Rata-Rata Skor per Unsur Pelayanan
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 font-semibold">
                                    Analisis 11 Unsur Indikator Pelayanan Publik Lengkap dengan Model Speedometer / Gauge Capaian Mutu
                                </p>
                            </div>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                                Skala 1 - 4 (Permenpan RB)
                            </span>
                        </div>

                        {/* SPEEDOMETER MINI GAUGES GRID UNTUK SELURUH 11 CAPAIAN INDIKATOR (POIN 1) */}
                        <div className="mb-8">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3.5 flex items-center gap-1.5">
                                <Gauge className="w-4 h-4 text-emerald-500" />
                                Capaian per Indikator Layanan
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                                {barChartData.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-slate-50/90 hover:bg-slate-50 p-3 rounded-2xl border border-slate-200/80 transition-all flex flex-col items-center justify-between text-center group hover:border-blue-400 hover:shadow-xs"
                                    >
                                        <div className="w-full mb-1">
                                            <span className="inline-block text-[9px] font-black text-slate-400 mb-0.5">U{idx + 1}</span>
                                            <p className="text-[11px] font-black text-slate-700 line-clamp-2 leading-tight h-7 flex items-center justify-center px-1" title={item.name}>
                                                {item.name}
                                            </p>
                                        </div>
                                        <div className="w-full flex items-center justify-center my-0.5">
                                            <SpeedometerGauge
                                                value={item.konversi}
                                                min={25}
                                                max={100}
                                                size={135}
                                                compact={true}
                                                showTicks={false}
                                                gradeLabel={`Mutu ${item.mutu}`}
                                            />
                                        </div>
                                        <div className="w-full pt-2 border-t border-slate-200/60 mt-1 flex justify-between items-center text-[10px] px-1">
                                            <span className="text-slate-400 font-bold">Indeks</span>
                                            <span className="font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200/70">
                                                {item.skor.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bar Chart 11 Unsur Lengkap */}
                        <div className="h-[320px] w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barChartData} margin={{ top: 20, right: 20, left: -10, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }}
                                        angle={-35}
                                        textAnchor="end"
                                        interval={0}
                                        height={65}
                                    />
                                    <YAxis domain={[0, 4]} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="skor" radius={[6, 6, 0, 0]} barSize={26}>
                                        {barChartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.skor >= 3.53 ? '#10b981' : entry.skor >= 3.06 ? '#3b82f6' : entry.skor >= 2.6 ? '#f59e0b' : '#ef4444'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* FRAME 3: RANKING KEPUASAN UNIT KERJA */}
                    <motion.div variants={itemMotion} className="bg-white rounded-3xl shadow-sm border border-slate-200/90 p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                    <Award className="w-5 h-5 text-amber-500" /> Peringkat Indeks Kepuasan per Unit Kerja
                                </h3>
                                <p className="text-xs font-semibold text-slate-500 mt-1">Perbandingan skor rata-rata CSAT dan IKM antar unit layanan</p>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setRankingFilter('all')}
                                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors ${rankingFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    Semua
                                </button>
                                <button
                                    onClick={() => setRankingFilter('top10')}
                                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors ${rankingFilter === 'top10' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    Top 10
                                </button>
                                <button
                                    onClick={() => setRankingFilter('bottom10')}
                                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors ${rankingFilter === 'bottom10' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    Bottom 10
                                </button>
                            </div>
                        </div>

                        <div className="h-[340px] w-full">
                            {unitRankingData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={unitRankingData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" domain={[0, 4]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 800, color: '#0f172a' }}
                                        />
                                        <Bar dataKey="skor" radius={[0, 6, 6, 0]} barSize={20}>
                                            {unitRankingData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.skor >= 3.53 ? '#10b981' : entry.skor >= 3.06 ? '#3b82f6' : entry.skor >= 2.6 ? '#f59e0b' : '#ef4444'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <p className="text-sm font-semibold">Belum ada data survei untuk unit kerja.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* FRAME 4: TABULASI LAPORAN RESPONDEN */}
                    <motion.div variants={itemMotion} className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-slate-900 text-lg">Tabulasi Riwayat Responden & Umpan Balik</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-1">Daftar riwayat survei kepuasan yang dikirimkan melalui layanan portal publik.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-100 font-black tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3.5">Tanggal / ID</th>
                                        <th className="px-5 py-3.5">Profil Responden</th>
                                        <th className="px-5 py-3.5">Unit Layanan</th>
                                        <th className="px-5 py-3.5 text-center">Skor Rata-Rata</th>
                                        <th className="px-5 py-3.5 max-w-sm">Saran / Masukan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {tableData.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold">
                                                Belum ada responden yang mengisi survei.
                                            </td>
                                        </tr>
                                    ) : (
                                        tableData.map((row) => (
                                            <tr key={row.no} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-5 py-3 font-semibold text-slate-600 whitespace-nowrap">
                                                    <div>{row.tanggal}</div>
                                                    <span className="text-[10px] font-mono text-slate-400">{row.id}</span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <p className="font-extrabold text-slate-900">{row.nama}</p>
                                                    <p className="text-[11px] text-slate-500 font-medium">{row.pekerjaan} ({row.umur})</p>
                                                </td>
                                                <td className="px-5 py-3 font-bold text-slate-700">{row.unit}</td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${Number(row.skor) >= 3.0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                                        <Star className="w-3 h-3 fill-current" />
                                                        {row.skor}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <p className="text-xs text-slate-600 line-clamp-2 max-w-sm leading-relaxed" title={row.feedback}>
                                                        {row.feedback}
                                                    </p>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    )
}
