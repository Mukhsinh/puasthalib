'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, TrendingUp, Users, Star, Award, Heart, MessageSquare, Briefcase, Filter } from 'lucide-react'
import * as xlsx from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings } from '@/utils/appSettings'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'

const SURVEY_QUESTIONS = [
    { id: 'q1', title: 'Persyaratan' },
    { id: 'q2', title: 'Prosedur' },
    { id: 'q3', title: 'Waktu Pelayanan' },
    { id: 'q4', title: 'Biaya / Tarif' },
    { id: 'q5', title: 'Produk Spesifikasi' },
    { id: 'q6', title: 'Kompetensi Pelaksana' },
    { id: 'q7', title: 'Perilaku Pelaksana' },
    { id: 'q8', title: 'Sarana & Prasarana' },
    { id: 'q9', title: 'Penanganan Pengaduan' },
    { id: 'q10', title: 'Transparansi' },
    { id: 'q11', title: 'Integritas' }
]

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']

export default function AnalisisKepuasanPage() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [rankingFilter, setRankingFilter] = useState<'all' | 'top10' | 'bottom10'>('all')
    const [rawSurveys, setRawSurveys] = useState<any[]>([])
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

    useEffect(() => {
        const fetchInitialData = async () => {
            const supabase = createClient()

            const settings = await fetchAppSettings(supabase)
            setAppSettings({
                kop_nama: settings.kop_nama,
                kop_rs: settings.kop_rs,
                kop_alamat: settings.kop_alamat,
                kop_kontak: settings.kop_kontak,
                app_logo: settings.app_logo
            })
            setSignerName(settings.nama_penandatangan)
            setSignerRole(settings.jabatan_penandatangan)

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

            let query = supabase.from('tickets')
                .select('*, units!unit_id(nama)')
                .eq('jenis', 'survei')
                .order('created_at', { ascending: false })

            if (role === 'user' && profileUnitId) {
                query = query.eq('unit_id', profileUnitId)
            }
            const { data } = await query

            if (data) {
                setRawSurveys(data)
            }
        }
        fetchInitialData()
    }, [])
    // Analytics derived from rawSurveys
    const totalRespondents = rawSurveys.length

    // Calculate global average rating
    let totalScoreSum = 0
    let totalQuestionsAnswered = 0
    const questionScores = SURVEY_QUESTIONS.map(q => ({ name: q.title, total: 0, count: 0 }))

    const pekerjaanCount: Record<string, number> = {}
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

            // Aggregate question scores
            SURVEY_QUESTIONS.forEach((q, i) => {
                if (payload.ratings[q.id]) {
                    questionScores[i].total += payload.ratings[q.id]
                    questionScores[i].count += 1
                }
            })
        }

        const job = payload.pekerjaan || 'Lainnya'
        pekerjaanCount[job] = (pekerjaanCount[job] || 0) + 1

        const unitName = s.units?.nama || 'Global'

        // Aggregate unit scores (only consider > 0 to avoid blank surveys bringing it down)
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
            umur: payload.umur || '-',
            pekerjaan: job,
            unit: unitName,
            skor: avgRating.toFixed(2),
            feedback: payload.feedback || '-'
        }
    })

    const globalAvg = totalQuestionsAnswered > 0 ? (totalScoreSum / totalQuestionsAnswered).toFixed(2) : '0.00'
    const barChartData = questionScores.map(q => ({
        name: q.name,
        skor: q.count > 0 ? Number((q.total / q.count).toFixed(2)) : 0
    }))

    const pieChartData = Object.keys(pekerjaanCount).map(key => ({
        name: key,
        value: pekerjaanCount[key]
    }))

    // Generate Unit Ranking Data
    let unitRankingData = Object.keys(unitScores).map(name => ({
        name,
        count: unitScores[name].count,
        skor: unitScores[name].count > 0 ? Number((unitScores[name].total / unitScores[name].count).toFixed(2)) : 0
    })).sort((a, b) => b.skor - a.skor) // Sort desc natively

    if (rankingFilter === 'top10') {
        unitRankingData = unitRankingData.slice(0, 10)
    } else if (rankingFilter === 'bottom10') {
        unitRankingData = unitRankingData.slice(-10).reverse() // Show worst at the top of the group
    }

    const handleExportExcel = () => {
        setIsGenerating(true)
        setTimeout(() => {
            const worksheetData = tableData.map(t => ({
                No: t.no,
                'ID Survei': t.id,
                Tanggal: t.tanggal,
                Responden: t.nama,
                Umur: t.umur,
                Pekerjaan: t.pekerjaan,
                'Unit Layanan': t.unit,
                'Skor Rata-Rata': t.skor,
                Saran: t.feedback
            }))

            const unitRankingSheetData = unitRankingData.map((u, i) => ({
                'Peringkat': i + 1,
                'Unit Layanan': u.name,
                'Total Ulasan': u.count,
                'Skor Kepuasan': Number(u.skor).toFixed(2)
            }))

            const worksheet = xlsx.utils.json_to_sheet([])

            xlsx.utils.sheet_add_aoa(worksheet, [
                [appSettings.kop_nama.toUpperCase()],
                [appSettings.kop_rs.toUpperCase()],
                [`${appSettings.kop_alamat} | ${appSettings.kop_kontak}`],
                [],
                ['LAPORAN HASIL ANALISIS SURVEI KEPUASAN MASYARAKAT (IKM)'],
                [`Tanggal Cetak: ${new Date(printDate).toLocaleDateString('id-ID')}`],
                [],
                [`Total Responden: ${totalRespondents} orang`],
                [`Indeks Kepuasan Global: ${globalAvg}/4.00`],
                [`Predikat: ${Number(globalAvg) >= 3.5 ? 'Sangat Baik' : Number(globalAvg) >= 3.0 ? 'Baik' : Number(globalAvg) >= 2.0 ? 'Kurang' : 'Buruk'}`],
                [],
                ['1. Rekapitulasi Penilaian per Unit Kerja']
            ], { origin: 'A1' })

            xlsx.utils.sheet_add_json(worksheet, unitRankingSheetData, { origin: 'A14' })

            xlsx.utils.sheet_add_aoa(worksheet, [
                [''],
                ['2. Tabulasi Responden Survei Kepuasan (Detil Lengkap)']
            ], { origin: `A${15 + unitRankingSheetData.length}` })

            xlsx.utils.sheet_add_json(worksheet, worksheetData, { origin: `A${18 + unitRankingSheetData.length}` })

            const workbook = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(workbook, worksheet, "Analisis_Kepuasan_Komprehensif")
            xlsx.writeFile(workbook, `Report_Kepuasan_Layanan_${new Date().toISOString().slice(0, 10)}.xlsx`)
            setIsGenerating(false)
        }, 1000)
    }

    const handleExportPDF = () => {
        setIsGenerating(true)
        setTimeout(() => {
            const predicate = Number(globalAvg) >= 3.5 ? 'Sangat Baik' : Number(globalAvg) >= 3.0 ? 'Baik' : Number(globalAvg) >= 2.0 ? 'Kurang' : 'Buruk';

            // First table: Unit ranking
            const tableHeaders = ['Peringkat', 'Unit Layanan', 'Total Responden', 'Indeks / Skor Kepuasan'];
            const pdfTableData = unitRankingData.map((u, i) => [
                i + 1,
                u.name,
                u.count,
                `${Number(u.skor).toFixed(2)}/4.00`
            ]);

            // Second table: Respondents
            const tableHeadersBottom = ['No', 'Tanggal', 'Responden (Pekerjaan)', 'Unit Layanan', 'Skor', 'Saran / Masukan'];
            const pdfTableDataBottom = tableData.map(t => [
                t.no,
                t.tanggal,
                `${t.nama} (${t.pekerjaan})`,
                t.unit,
                t.skor,
                t.feedback
            ]);

            generateFormalPDF({
                title: 'LAPORAN HASIL ANALISIS SURVEI KEPUASAN MASYARAKAT (IKM)',
                additionalInfo: [
                    `Total Responden: ${totalRespondents} orang | Indeks Kepuasan Global: ${globalAvg}/4.00 | Predikat Penilaian Mutu: ${predicate}`,
                    '',
                    '1. Profil Penilaian Kepuasan per Unit Kerja:'
                ],
                filename: `Report_IKM_Komprehensif_${new Date().toISOString().slice(0, 10)}.pdf`,
                appSettings,
                printDate,
                signerName,
                signerRole,
                tableHeaders,
                tableData: pdfTableData,
                additionalInfoBottom: [
                    '',
                    '2. Tabulasi Responden dan Umpan Balik Layanan:'
                ],
                tableHeadersBottom,
                tableDataBottom: pdfTableDataBottom
            });
            setIsGenerating(false)
        }, 500)
    }

    return (
        <div className="w-full relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                        <Heart className="w-8 h-8 text-rose-500" />
                        Analisis Kepuasan
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Dashboard analitik Indeks Kepuasan Masyarakat (IKM) dan umpan balik layanan.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportExcel}
                        disabled={isGenerating}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <Download className="w-5 h-5 text-emerald-600" />
                        {isGenerating ? 'Memroses...' : 'Unduh Excel'}
                    </button>

                    <button
                        onClick={handleExportPDF}
                        disabled={isGenerating}
                        className="px-5 py-2.5 bg-slate-900 border border-slate-800 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <FileText className="w-5 h-5 text-indigo-400" />
                        {isGenerating ? 'Memroses...' : 'Unduh PDF'}
                    </button>
                </div>
            </div>

            {/* Print configuration controls (hidden on print) */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 print:hidden flex flex-col md:flex-row gap-4 items-center">
                <div className="text-sm font-bold text-amber-800 flex items-center gap-2 min-w-max">
                    <FileText className="w-4 h-4" /> Pengaturan Cetak Header/Footer:
                </div>
                <div className="flex-1 flex gap-3 w-full">
                    <input
                        type="date"
                        value={printDate}
                        onChange={(e) => setPrintDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Nama Penandatangan"
                        className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-amber-500 flex-1"
                    />
                    <input
                        type="text"
                        value={signerRole}
                        onChange={(e) => setSignerRole(e.target.value)}
                        placeholder="Jabatan"
                        className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-amber-500 flex-1 hidden md:block"
                    />
                </div>
            </div>

            {/* 1. SCORE CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 print:hidden">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Users className="w-7 h-7 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Responden</p>
                        <h4 className="text-2xl font-black text-slate-800">{totalRespondents} <span className="text-sm font-medium text-slate-400">orang</span></h4>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                        <Star className="w-7 h-7 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Skor IKM Global</p>
                        <h4 className="text-2xl font-black text-slate-800">{globalAvg} <span className="text-sm font-medium text-slate-400">/ 4.00</span></h4>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 shadow-md border border-indigo-400/50 flex items-center gap-4 text-white">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                        <Award className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-indigo-100 uppercase tracking-widest mb-1">Predikat Mutu</p>
                        <h4 className="text-2xl font-black text-white">
                            {Number(globalAvg) >= 3.5 ? 'Sangat Baik' : Number(globalAvg) >= 3.0 ? 'Baik' : Number(globalAvg) >= 2.0 ? 'Kurang' : 'Buruk'}
                        </h4>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-7 h-7 text-rose-500" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Saran</p>
                        <h4 className="text-2xl font-black text-slate-800">
                            {rawSurveys.filter(s => s.data_payload?.feedback && s.data_payload.feedback.length > 5).length}
                        </h4>
                    </div>
                </motion.div>
            </div>

            {/* 2. CHARTS (Visible on screen and optionally formatted for print) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 print:hidden">
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-500" /> Rata-Rata Skor per Unsur Pelayanan</h3>
                            <p className="text-xs font-medium text-slate-500 mt-1">Skala 1 - 4 berdasarkan Permenpan RB</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                    angle={-45}
                                    textAnchor="end"
                                    interval={0}
                                    height={60}
                                />
                                <YAxis domain={[0, 4]} tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                                />
                                <Bar dataKey="skor" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30}>
                                    {barChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.skor >= 3.5 ? '#10b981' : entry.skor >= 2.5 ? '#6366f1' : '#f59e0b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="mb-6">
                        <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2"><Briefcase className="w-5 h-5 text-indigo-500" /> Demografi Responden</h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">Berdasarkan kategori pekerjaan</p>
                    </div>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        {pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-slate-400 font-medium text-sm">Belum ada data</div>
                        )}
                    </div>
                </div>
            </div>

            {/* GRAFIK RANKING UNIT KERJA */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8 print:hidden p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2"><Award className="w-5 h-5 text-amber-500" /> Ranking Kepuasan Unit Kerja</h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">Perbandingan skor rata-rata CSAT antar unit pelayanan</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setRankingFilter('all')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${rankingFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua Unit</button>
                        <button onClick={() => setRankingFilter('top10')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${rankingFilter === 'top10' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Top 10</button>
                        <button onClick={() => setRankingFilter('bottom10')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${rankingFilter === 'bottom10' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bottom 10</button>
                    </div>
                </div>
                <div className="h-[350px] w-full">
                    {unitRankingData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={unitRankingData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" domain={[0, 4]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fontWeight: 600, fill: '#475569' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                                />
                                <Bar dataKey="skor" radius={[0, 4, 4, 0]} barSize={20}>
                                    {unitRankingData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.skor >= 3.5 ? '#10b981' : entry.skor >= 2.5 ? '#3b82f6' : '#f43f5e'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <p className="text-sm font-medium">Belum ada data survei untuk unit kerja.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. TABULATION (Visible on screen) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8 print:hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">Tabulasi Laporan Responden</h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">Daftar riwayat survei kepuasan yang dikirimkan melalui layanan portal.</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-bold tracking-wider">Tanggal</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Responden</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Unit Layanan</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-center">Rata-Rata Skor</th>
                                <th className="px-6 py-4 font-bold tracking-wider max-w-sm">Saran / Masukan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tableData.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">Beban data tidak ditemukan atau kosong.</td></tr>
                            )}
                            {tableData.map((row) => (
                                <tr key={row.no} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-600 whitespace-nowrap">{row.tanggal}</td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-800">{row.nama}</p>
                                        <p className="text-xs text-slate-500">{row.pekerjaan}</p>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-600">{row.unit}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center items-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${Number(row.skor) >= 3.0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                                <Star className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                                                {row.skor}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs text-slate-600 line-clamp-2 max-w-sm leading-relaxed" title={row.feedback}>
                                            {row.feedback}
                                        </p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- FORMAL PRINT TEMPLATE (VISIBLE ONLY ON PRINT/PREVIEW) --- */}
            <div className="hidden print:block bg-white p-0 mx-auto max-w-[210mm] w-[100%] min-h-[297mm]">
                {/* Kop Surat (Header) */}
                <div className="flex items-center justify-between border-b-[3px] border-black pb-4 mb-1 border-double">
                    <div className="w-20 h-20 bg-slate-200 flex items-center justify-center font-bold text-slate-500 rounded-lg shrink-0 border border-slate-300">
                        {/* Space for Logo */}
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
                    <h3 className="text-sm font-bold uppercase underline underline-offset-4">Laporan Hasil Analisis Survei Kepuasan Masyarakat (IKM)</h3>
                    <p className="text-xs mt-1">Tanggal Cetak: {new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>

                {/* Print Summary */}
                <div className="flex border border-black mb-6 text-black">
                    <div className="flex-1 p-3 border-r border-black flex flex-col justify-center items-center">
                        <p className="text-xs uppercase font-bold text-center mb-1">Total Responden</p>
                        <h4 className="text-xl font-bold text-center">{totalRespondents} <span className="text-[10px] font-normal">orang</span></h4>
                    </div>
                    <div className="flex-1 p-3 border-r border-black flex flex-col justify-center items-center">
                        <p className="text-xs uppercase font-bold text-center mb-1">Indeks Kepuasan Global</p>
                        <h4 className="text-xl font-bold text-center">{globalAvg} <span className="text-[10px] font-normal">/ 4.00</span></h4>
                    </div>
                    <div className="flex-1 p-3 flex flex-col justify-center items-center">
                        <p className="text-xs uppercase font-bold text-center mb-1">Predikat Penilaian Mutu</p>
                        <h4 className="text-xl font-bold text-center uppercase tracking-wider">
                            {Number(globalAvg) >= 3.5 ? 'Sangat Baik' : Number(globalAvg) >= 3.0 ? 'Baik' : Number(globalAvg) >= 2.0 ? 'Kurang' : 'Buruk'}
                        </h4>
                    </div>
                </div>

                {/* Summary Table for Items */}
                <div className="mb-6 font-sans text-black">
                    <h4 className="text-xs font-bold uppercase mb-2">A. Analisis Komponen Indikator:</h4>
                    <table className="w-full text-xs text-left border-collapse border border-black">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="border border-black p-1.5 text-center w-10">No</th>
                                <th className="border border-black p-1.5">Unsur / Indikator Penilaian</th>
                                <th className="border border-black p-1.5 text-center w-24">Skor Rata-Rata</th>
                                <th className="border border-black p-1.5 text-center w-24">Kategori Mutu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {barChartData.map((q, i) => (
                                <tr key={i}>
                                    <td className="border border-black p-1.5 text-center">{i + 1}</td>
                                    <td className="border border-black p-1.5 font-semibold">{q.name}</td>
                                    <td className="border border-black p-1.5 text-center">{q.skor.toFixed(2)}</td>
                                    <td className="border border-black p-1.5 text-center">
                                        {q.skor >= 3.5 ? 'Sangat Baik' : q.skor >= 2.5 ? 'Baik' : 'Kurang'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Detailed Table */}
                <div className="mb-6 font-sans text-black">
                    <h4 className="text-xs font-bold uppercase mb-2">B. Tabulasi Responden Terbaru:</h4>
                    <table className="w-full text-[10px] text-left border-collapse border border-black">
                        <thead className="bg-slate-100 font-bold">
                            <tr>
                                <th className="border border-black p-1.5 text-center w-8">No</th>
                                <th className="border border-black p-1.5">ID / Tgl</th>
                                <th className="border border-black p-1.5">Profil Responden</th>
                                <th className="border border-black p-1.5">Unit Tujuan</th>
                                <th className="border border-black p-1.5 text-center w-16">Skor</th>
                                <th className="border border-black p-1.5">Saran / Masukan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.slice(0, 15).map((row, i) => (
                                <tr key={i}>
                                    <td className="border border-black p-1.5 text-center font-bold">{i + 1}</td>
                                    <td className="border border-black p-1.5">
                                        {row.id}<br />{row.tanggal}
                                    </td>
                                    <td className="border border-black p-1.5">
                                        {row.nama}<br /><span className="italic">{row.pekerjaan} ({row.umur})</span>
                                    </td>
                                    <td className="border border-black p-1.5">{row.unit}</td>
                                    <td className="border border-black p-1.5 text-center font-bold">{row.skor}</td>
                                    <td className="border border-black p-1.5">{row.feedback}</td>
                                </tr>
                            ))}
                            {tableData.length > 15 && (
                                <tr>
                                    <td colSpan={6} className="border border-black p-1.5 text-center italic">
                                        *(Menampilkan 15 data terbaru, silakan gunakan fitur Ekspor Excel untuk rekapitulasi data lengkap)*
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Signatures */}
                <div className="mt-8 flex justify-end text-black font-sans">
                    <div className="text-center w-64">
                        <p className="text-xs mb-16">{appSettings.kop_nama.replace('Pemerintah ', '').replace('Provinsi ', '').replace('Kabupaten ', '')}, {new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-xs font-bold underline underline-offset-2">{signerName}</p>
                        <p className="text-[10px] mt-1">{signerRole}</p>
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
