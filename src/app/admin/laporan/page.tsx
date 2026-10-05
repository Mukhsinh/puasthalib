'use client'

import React, { useState, useEffect } from 'react'
import { FileText, Download, Calendar, Filter, Activity, Users, Zap, Briefcase } from 'lucide-react'
import * as xlsx from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings } from '@/utils/appSettings'

export default function LaporanEksportPage() {
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
    const [signerName, setSignerName] = useState('')
    const [signerRole, setSignerRole] = useState('')
    const [appSettings, setAppSettings] = useState({ kop_nama: 'Pemerintah Kota Sejahtera', kop_rs: 'Rumah Sakit Umum Daerah', kop_alamat: 'Jl. Jend. Sudirman No. 123, Telepon: (021) 555-0192', kop_kontak: 'Email: rsud@sejahtera.go.id | Website: rsud.sejahtera.go.id', app_logo: '' })

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient()

            const { data: { session } } = await supabase.auth.getSession()
            let profileUnitId = null
            let role = 'user'
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
            const { data: unitsData } = await unitQuery
            if (unitsData) setUnits(unitsData)

            // 2. Fetch app settings
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

            // 3. Fetch all tickets
            let ticketQuery = supabase.from('tickets').select('*, units!unit_id(nama)').order('created_at', { ascending: false })
            if (role === 'user' && profileUnitId) {
                ticketQuery = ticketQuery.eq('unit_id', profileUnitId)
            }
            const { data } = await ticketQuery
            if (data) {
                const formatted = data.map((d: any, i: number) => ({
                    id_raw: d.id,
                    no: i + 1,
                    id_tiket: d.tracking_number,
                    tanggal: new Date(d.created_at).toLocaleDateString('id-ID'),
                    raw_date: d.created_at,
                    pengirim: d.data_payload?.nama || 'Anonim',
                    kategori: d.jenis.replace('_', ' ').toUpperCase(),
                    unit: d.units?.nama || 'Global',
                    unit_id: d.unit_id,
                    status: d.status,
                    kepuasan: d.data_payload?.ratings ? 'Dinilai' : '-'
                }))
                setTicketData(formatted)
            }
        }
        fetchData()
    }, [])

    // FILTER LOGIC
    const filteredData = ticketData.filter(t => {
        let matchDate = true
        let matchUnit = true
        let matchJenis = true

        if (dateRange.start && dateRange.end) {
            const ticketDate = new Date(t.raw_date).getTime()
            const sDate = new Date(dateRange.start).getTime()
            // Add 1 day to end date to make it inclusive
            const eDate = new Date(dateRange.end).getTime() + (24 * 60 * 60 * 1000)
            if (ticketDate < sDate || ticketDate > eDate) matchDate = false
        }

        if (filterUnit !== 'Semua' && t.unit_id !== filterUnit) matchUnit = false
        if (filterJenis !== 'Semua' && t.kategori !== filterJenis) matchJenis = false

        return matchDate && matchUnit && matchJenis
    })

    // METRICS
    const totalCount = filteredData.length
    const selesaiCount = filteredData.filter(d => d.status === 'Selesai').length
    const surveiCount = filteredData.filter(d => d.kategori === 'SURVEI').length
    const pengaduanCount = filteredData.filter(d => d.kategori === 'PENGADUAN LAYANAN' || d.kategori === 'ADUAN').length

    // CHART DATA (Trend grouped by category)
    const categoryGroup = filteredData.reduce((acc, curr) => {
        acc[curr.kategori] = (acc[curr.kategori] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const chartData = Object.keys(categoryGroup).map(k => ({
        name: k,
        total: categoryGroup[k]
    }))

    // RANKING DATA (By total tickets)
    const unitRankingGroup = filteredData.reduce((acc, curr) => {
        acc[curr.unit] = (acc[curr.unit] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const rankingData = Object.keys(unitRankingGroup)
        .map(k => ({ name: k, total: unitRankingGroup[k] }))
        .sort((a, b) => b.total - a.total)

    const handleExportExcel = () => {
        setIsGenerating(true)
        setTimeout(() => {
            try {
                const worksheetData = filteredData.map(e => ({
                    No: e.no,
                    'ID Tiket': e.id_tiket,
                    Tanggal: e.tanggal,
                    Pengirim: e.pengirim,
                    Kategori: e.kategori,
                    Unit: e.unit,
                    Status: e.status
                }))

                const rankingSheetData = rankingData.map((r, i) => ({
                    'Peringkat': i + 1,
                    'Unit Kerja': r.name,
                    'Total Tiket': r.total
                }))

                const worksheet = xlsx.utils.json_to_sheet([])

                xlsx.utils.sheet_add_aoa(worksheet, [
                    [appSettings.kop_nama.toUpperCase()],
                    [appSettings.kop_rs.toUpperCase()],
                    [`${appSettings.kop_alamat} | ${appSettings.kop_kontak}`],
                    [],
                    ['LAPORAN REKAPITULASI LAYANAN DAN KOMPLAIN (KOMPREHENSIF)'],
                    [`Tanggal Cetak: ${new Date(printDate).toLocaleDateString('id-ID')}`],
                    [`Penanggung Jawab: ${signerName} (${signerRole})`],
                    [`Periode: ${dateRange.start ? `${dateRange.start} s/d ${dateRange.end || 'Sekarang'}` : 'Seluruh Riwayat'}`],
                    [`Filter Unit: ${filterUnit === 'Semua' ? 'Keseluruhan' : units.find(u => u.id === filterUnit)?.nama || filterUnit}`],
                    [`Filter Kategori: ${filterJenis}`],
                    [],
                    [`Rangkuman KPI: Total ${totalCount} Data | Selesai ${selesaiCount} | Survei ${surveiCount} | Pengaduan ${pengaduanCount}`],
                    [],
                    ['A. Ranking Unit Kerja Berdasarkan Volume Aduan']
                ], { origin: 'A1' })

                xlsx.utils.sheet_add_json(worksheet, rankingSheetData, { origin: 'A16' })

                xlsx.utils.sheet_add_aoa(worksheet, [
                    [''],
                    ['B. Tabulasi Detail Rekapitulasi Data']
                ], { origin: `A${17 + rankingSheetData.length}` })

                xlsx.utils.sheet_add_json(worksheet, worksheetData, { origin: `A${20 + rankingSheetData.length}` })

                const workbook = xlsx.utils.book_new()
                xlsx.utils.book_append_sheet(workbook, worksheet, "Laporan_Komprehensif")
                xlsx.writeFile(workbook, `Laporan_PUAS_Komprehensif_${new Date().toISOString().slice(0, 10)}.xlsx`)
            } catch (error) {
                console.error("XLSX export failed:", error)
                alert("Gagal melakukan ekspor.")
            }
            setIsGenerating(false)
        }, 1000)
    }

    const handleExportPDF = () => {
        setIsGenerating(true)
        setTimeout(() => {
            // First table: ranking
            const rankHeaders = ['Peringkat', 'Unit Kerja', 'Total Tiket Masuk']
            const rankTableData = rankingData.map((r, i) => [
                i + 1,
                r.name,
                r.total
            ]);

            // Second table: details
            const tableHeaders = ['No', 'ID Tiket', 'Tanggal', 'Pengirim', 'Kategori', 'Unit Kerja', 'Status']
            const pdfTableData = filteredData.map((d, index) => [
                index + 1,
                d.id_tiket,
                d.tanggal,
                d.pengirim,
                d.kategori,
                d.unit,
                d.status
            ]);
            let filterDesc = `Periode: ${dateRange.start ? `${dateRange.start} s/d ${dateRange.end || 'Sekarang'}` : 'Seluruh Riwayat'} | Unit: ${filterUnit === 'Semua' ? 'Keseluruhan' : units.find(u => u.id === filterUnit)?.nama || filterUnit} | Kategori: ${filterJenis}`

            generateFormalPDF({
                title: 'LAPORAN REKAPITULASI LAYANAN KOMPLAIN DAN SURVEI (KOMPREHENSIF)',
                additionalInfo: [
                    filterDesc,
                    `Rangkuman KPI: Total ${totalCount} Data | Selesai ${selesaiCount} (${totalCount > 0 ? Math.round((selesaiCount / totalCount) * 100) : 0}%) | Survei ${surveiCount} | Pengaduan ${pengaduanCount}`,
                    '',
                    'A. Ranking Unit Kerja Berdasarkan Volume Aduan Masuk:'
                ],
                filename: `Laporan_PUAS_Komprehensif_${new Date().toISOString().slice(0, 10)}.pdf`,
                appSettings,
                printDate,
                signerName,
                signerRole,
                tableHeaders: rankHeaders,
                tableData: rankTableData,
                additionalInfoBottom: [
                    '',
                    'B. Tabulasi Detail Tiket dan Rekapitulasi Laporan:'
                ],
                tableHeadersBottom: tableHeaders,
                tableDataBottom: pdfTableData
            });
            setIsGenerating(false)
        }, 500)
    }

    return (
        <div className="w-full relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                        <FileText className="w-8 h-8 text-emerald-500" />
                        Laporan Analisis
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Buat rekapitulasi data layanan berdasarkan jenis, waktu, dan unit instansi.</p>
                </div>
            </div>

            {/* FILTERS & CONTROLS */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-8 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> Rentang Waktu
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-3 py-2.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-3 py-2.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Briefcase className="w-4 h-4" /> Unit Kerja
                        </label>
                        <select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            disabled={userRole === 'user'}
                            className="w-full px-4 py-2.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {userRole !== 'user' && <option value="Semua">Semua Unit Kerja</option>}
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.nama}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Filter className="w-4 h-4" /> Jenis Laporan
                        </label>
                        <select
                            value={filterJenis}
                            onChange={(e) => setFilterJenis(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        >
                            <option value="Semua">Seluruh Kategori</option>
                            <option value="SURVEI">Survei Kepuasan</option>
                            <option value="PENGADUAN LAYANAN">Pengaduan Layanan</option>
                            <option value="PERMINTAAN INFORMASI">Permintaan Informasi</option>
                        </select>
                    </div>

                    {/* SETTINGS FOR PRINT (INLINE) */}
                    <div className="md:col-span-12 mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex-1 w-full gap-3 flex flex-col sm:flex-row">
                            <input
                                type="text"
                                value={signerName}
                                onChange={(e) => setSignerName(e.target.value)}
                                placeholder="Nama Penandatangan"
                                className="px-4 py-2 border rounded-xl text-sm font-semibold bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 flex-1"
                            />
                            <input
                                type="text"
                                value={signerRole}
                                onChange={(e) => setSignerRole(e.target.value)}
                                placeholder="Jabatan"
                                className="px-4 py-2 border rounded-xl text-sm font-semibold bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 flex-1 hidden md:block"
                            />
                            <input
                                type="date"
                                value={printDate}
                                onChange={(e) => setPrintDate(e.target.value)}
                                className="px-4 py-2 border rounded-xl text-sm font-semibold bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 w-auto"
                            />
                        </div>

                        <div className="flex gap-3 shrink-0">
                            <button
                                disabled={isGenerating}
                                onClick={handleExportExcel}
                                className="px-5 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-2 border border-emerald-200"
                            >
                                <Download className="w-5 h-5" />
                                {isGenerating ? 'Memproses...' : 'Ekspor Excel'}
                            </button>

                            <button
                                onClick={handleExportPDF}
                                disabled={isGenerating}
                                className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-md shadow-slate-900/20 disabled:opacity-50"
                            >
                                <FileText className="w-5 h-5" />
                                {isGenerating ? 'Memproses...' : 'Unduh PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SCORE CARDS PREVIEW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 print:hidden">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Activity className="w-7 h-7 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Data</p>
                        <h4 className="text-2xl font-black text-slate-800">{totalCount}</h4>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                        <Zap className="w-7 h-7 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tiket Selesai</p>
                        <h4 className="text-2xl font-black text-slate-800">{selesaiCount}</h4>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                        <FileText className="w-7 h-7 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Survei</p>
                        <h4 className="text-2xl font-black text-slate-800">{surveiCount}</h4>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                        <Users className="w-7 h-7 text-red-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Terkait Aduan</p>
                        <h4 className="text-2xl font-black text-slate-800">{pengaduanCount}</h4>
                    </div>
                </motion.div>
            </div>

            {/* SEBARAN CHART & RANKING CHART */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 print:hidden">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-extrabold text-slate-800 text-lg mb-2">Sebaran Kategori Layanan</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} height={40} angle={-15} textAnchor="end" />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px' }} />
                                <Bar dataKey="total" fill="#3b82f6" barSize={40} radius={[4, 4, 0, 0]}>
                                    {chartData.map((_entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={'#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="font-extrabold text-slate-800 text-lg mb-2">Ranking Unit Kerja Terbanyak</h3>
                    <div className="h-[250px] w-full">
                        {rankingData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rankingData.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fontWeight: 600, fill: '#475569' }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px' }} />
                                    <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data unit rujukan</div>
                        )}
                    </div>
                </div>
            </div>

            {/* TABULAR PREVIEW */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8 print:hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-extrabold text-slate-800 text-lg">Pratinjau Data Tabel</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Data di bawah ini akan di-render saat mencetak PDF berdasarkan filter.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-bold tracking-wider">Tanggal</th>
                                <th className="px-6 py-4 font-bold tracking-wider">ID Tiket</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Kategori</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Unit Kerja</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.slice(0, 50).map((row) => (
                                <tr key={row.no} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-600 whitespace-nowrap">{row.tanggal}</td>
                                    <td className="px-6 py-4 font-mono font-bold text-slate-800">{row.id_tiket}</td>
                                    <td className="px-6 py-4 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mt-3 ml-6">{row.kategori}</td>
                                    <td className="px-6 py-4 font-medium text-slate-600">{row.unit}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${row.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length > 50 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm font-medium text-slate-500 italic">
                                        Menampilkan 50 entri teratas. Ekspor ke Excel untuk melihat semua {filteredData.length} baris data.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}
