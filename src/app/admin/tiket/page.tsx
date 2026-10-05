'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Inbox,
    Filter,
    Download,
    ArrowRight,
    MessageSquare,
    Clock,
    X,
    CheckCircle2,
    ShieldCheck,
    Mail,
    Edit,
    FileText,
    AlertTriangle,
    History as HistoryIcon,
    Search,
    ChevronRight,
    Building2,
    Sparkles,
    Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import * as xlsx from 'xlsx'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings } from '@/utils/appSettings'

export default function AdminTiketPage() {
    const [tickets, setTickets] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [selectedTicket, setSelectedTicket] = useState<any>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const supabase = createClient()
    const [isGenerating, setIsGenerating] = useState(false)
    const [units, setUnits] = useState<any[]>([])
    const [profiles, setProfiles] = useState<any[]>([])
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [ticketHistory, setTicketHistory] = useState<any[]>([])

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('Semua')

    const [actionForm, setActionForm] = useState({
        actionType: 'respon',
        lapor_ke_role: '',
        lapor_unit_id: '',
        eskalasi_unit_id: '',
        tembusan_unit_id: '',
        catatan: '',
        statusUpdate: '' // auto status: 'eskalasi' or 'selesai'
    })

    // Setup for formal print report matching app_settings
    const [printDate, setPrintDate] = useState(new Date().toISOString().slice(0, 10))
    const [signerName, setSignerName] = useState('')
    const [signerRole, setSignerRole] = useState('')
    const [appSettings, setAppSettings] = useState({
        kop_nama: 'Pemerintah Kota Sejahtera',
        kop_rs: 'Rumah Sakit Umum Daerah',
        kop_alamat: 'Jl. Jend. Sudirman No. 123, Telepon: (021) 555-0192',
        kop_kontak: 'Email: rsud@sejahtera.go.id | Website: rsud.sejahtera.go.id',
        app_logo: ''
    })
    const [whatsappKontak, setWhatsappKontak] = useState('')

    const HIDDEN_KEYS = ['unit_id', 'id', 'submitter_id', 'original_unit_id', 'tindakan_terakhir', 'unitId', 'unit Id', 'rating', 'ratings']

    const fetchData = async () => {
        setIsLoading(true)

        // Settings
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
        setWhatsappKontak(settings.whatsapp_kontak)

        // Tickets
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*, units!unit_id(nama)')
                .eq('id', session.user.id)
                .single()

            const effectiveProfile = profile || { role: 'superadmin', unit_id: null }
            setCurrentUser(effectiveProfile)

            let query = supabase.from('tickets').select('*, units!unit_id(nama)').order('created_at', { ascending: false })

            if (effectiveProfile.role !== 'superadmin' && effectiveProfile.role !== 'admin' && effectiveProfile.unit_id) {
                query = query.or(`unit_id.eq.${effectiveProfile.unit_id},original_unit_id.eq.${effectiveProfile.unit_id}`)
            }

            const { data, error } = await query
            if (error) console.error('Error fetching tickets:', error)
            setTickets(data || [])
        } else {
            setTickets([])
        }

        // Units & Profiles for Escalation
        const { data: unitsData } = await supabase.from('units').select('id, nama').order('nama')
        setUnits(unitsData || [])
        const { data: profilesData } = await supabase.from('profiles').select('id, nama_lengkap, role, unit_id').order('nama_lengkap')
        setProfiles(profilesData || [])

        setIsLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleOpenDetail = async (ticket: any) => {
        setSelectedTicket(ticket)
        setIsDetailOpen(true)
        setActionForm({
            actionType: 'respon',
            lapor_ke_role: '',
            lapor_unit_id: '',
            eskalasi_unit_id: '',
            tembusan_unit_id: '',
            catatan: '',
            statusUpdate: ''
        })

        const { data: history } = await supabase
            .from('ticket_history')
            .select('*, units!from_unit_id(nama)')
            .eq('ticket_id', ticket.id)
            .order('updated_at', { ascending: false })
        setTicketHistory(history || [])
    }

    const handleExecuteAction = async () => {
        if (!selectedTicket) return;
        setIsUpdating(true);

        const payload = {
            action: actionForm.actionType,
            ...actionForm,
            timestamp: new Date().toISOString()
        };

        const newPayload = {
            ...(selectedTicket.data_payload || {}),
            tindakan_terakhir: payload
        }

        let newStatus = selectedTicket.status
        if (actionForm.statusUpdate === 'eskalasi') {
            newStatus = 'Diproses'
        } else if (actionForm.statusUpdate === 'selesai') {
            newStatus = 'Selesai'
        }

        const updateObj: any = {
            data_payload: newPayload,
            status: newStatus
        }

        if (actionForm.actionType === 'eskalasi' && actionForm.eskalasi_unit_id) {
            if (!selectedTicket.original_unit_id) {
                updateObj.original_unit_id = selectedTicket.unit_id
            }
            updateObj.unit_id = actionForm.eskalasi_unit_id
        }

        const { error } = await supabase.from('tickets').update(updateObj).eq('id', selectedTicket.id);

        if (!error) {
            const { error: historyError } = await supabase.from('ticket_history').insert({
                ticket_id: selectedTicket.id,
                from_unit_id: currentUser?.unit_id,
                to_unit_id: actionForm.actionType === 'eskalasi' ? actionForm.eskalasi_unit_id :
                    actionForm.actionType === 'lapor' ? actionForm.lapor_unit_id : null,
                status: newStatus,
                notes: actionForm.catatan || (actionForm.actionType === 'eskalasi' ? 'Tiket dieskalasikan' : 'Respon diberikan'),
                updated_by: currentUser?.id
            })

            if (historyError) {
                console.error('History Error:', historyError)
            }

            setActionForm({ actionType: 'respon', catatan: '', lapor_ke_role: '', lapor_unit_id: '', eskalasi_unit_id: '', tembusan_unit_id: '', statusUpdate: '' });
            fetchData();
            setIsDetailOpen(false);
            alert('Tindakan berhasil dikirim!');
        } else {
            alert('Gagal mengirim tindakan: ' + error.message);
        }
        setIsUpdating(false);
    }

    const handleExportExcel = () => {
        setIsGenerating(true)
        setTimeout(() => {
            const worksheetData = tickets.map((t, index) => {
                const reporter = t.data_pelapor?.nama || t.data_payload?.nama || '-'
                const phone = t.data_pelapor?.hp || t.data_payload?.hp || '-'
                const detail = t.data_payload?.uraian || t.data_payload?.feedback || t.data_payload?.informasi_diminta || '-'

                return {
                    No: index + 1,
                    'ID Tiket': t.tracking_number,
                    Tanggal: new Date(t.created_at).toLocaleString('id-ID'),
                    Kategori: t.jenis.replace(/_/g, ' ').toUpperCase(),
                    Unit: t.units?.nama || 'Global',
                    Status: t.status,
                    'Nama Pemohon / Pelapor': reporter,
                    'Nomor HP Pemohon': phone,
                    'Keperluan / Uraian Detail': detail,
                    'Tindakan Terakhir': t.data_payload?.tindakan_terakhir?.action || '-'
                }
            })

            const worksheet = xlsx.utils.json_to_sheet([])

            xlsx.utils.sheet_add_aoa(worksheet, [
                [appSettings.kop_nama.toUpperCase()],
                [appSettings.kop_rs.toUpperCase()],
                [`${appSettings.kop_alamat} | ${appSettings.kop_kontak}`],
                [],
                ['LAPORAN MANAJEMEN TIKET KOMPREHENSIF'],
                [`Tanggal Cetak: ${new Date(printDate).toLocaleDateString('id-ID')}`],
                [`Penanggung Jawab Laporan: ${signerName} (${signerRole})`],
                [],
                ['1. Tabulasi Data Tiket Masuk']
            ], { origin: 'A1' })

            xlsx.utils.sheet_add_json(worksheet, worksheetData, { origin: 'A10' })

            const workbook = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(workbook, worksheet, "Raw_Tiket")
            xlsx.writeFile(workbook, `Data_Tiket_${new Date().toISOString().slice(0, 10)}.xlsx`)
            setIsGenerating(false)
        }, 800)
    }

    const handleExportPDF = () => {
        setIsGenerating(true)
        setTimeout(() => {
            const tableHeaders = ['No', 'ID Tiket', 'Tanggal', 'Kategori', 'Unit', 'Status', 'Saran/Uraian'];
            const tableData = tickets.map((t, index) => {
                const detail = t.data_payload?.uraian || t.data_payload?.feedback || t.data_payload?.informasi_diminta || '-'
                return [
                    index + 1,
                    t.tracking_number,
                    new Date(t.created_at).toLocaleString('id-ID'),
                    t.jenis.replace(/_/g, ' ').toUpperCase(),
                    t.units?.nama || 'Global',
                    t.status,
                    detail
                ]
            });

            generateFormalPDF({
                title: 'LAPORAN MANAJEMEN TIKET (KOMPREHENSIF)',
                additionalInfo: [
                    'Laporan ini berisikan rincian seluruh tiket aduan, layanan, dan komplain yang terdaftar dalam sistem.',
                    `Total Laporan: ${tickets.length} Tiket | Tiket Selesai: ${tickets.filter(x => x.status === 'Selesai').length}`,
                    '',
                    '1. Rincian Tiket dan Uraian Laporan:'
                ],
                filename: `Laporan_Tiket_Komprehensif_${new Date().toISOString().slice(0, 10)}.pdf`,
                appSettings,
                printDate,
                signerName,
                signerRole,
                tableHeaders,
                tableData
            });
            setIsGenerating(false)
        }, 500)
    }

    // Filter tickets based on status tab & search query
    const filteredTickets = tickets.filter(t => {
        const matchesStatus = statusFilter === 'Semua' ? true :
            statusFilter === 'Menunggu' ? t.status === 'Terkirim' :
                statusFilter === 'Proses' ? (t.status === 'Diproses' || t.status === 'Proses') :
                    statusFilter === 'Selesai' ? t.status === 'Selesai' : true

        const q = searchQuery.toLowerCase()
        const reporterName = (t.data_pelapor?.nama || t.data_payload?.nama || '').toLowerCase()
        const trackingNum = (t.tracking_number || '').toLowerCase()
        const unitName = (t.units?.nama || '').toLowerCase()
        const jenisName = (t.jenis || '').toLowerCase()

        const matchesSearch = !q || trackingNum.includes(q) || reporterName.includes(q) || unitName.includes(q) || jenisName.includes(q)

        return matchesStatus && matchesSearch
    })

    const countStatus = (status: string) => {
        if (status === 'Semua') return tickets.length
        if (status === 'Menunggu') return tickets.filter(t => t.status === 'Terkirim').length
        if (status === 'Proses') return tickets.filter(t => t.status === 'Diproses' || t.status === 'Proses').length
        if (status === 'Selesai') return tickets.filter(t => t.status === 'Selesai').length
        return 0
    }

    const renderDataSection = (title: string, dataObj: any) => {
        if (!dataObj) return null
        const isUUID = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
        const filteredEntries = Object.entries(dataObj).filter(([key, value]) => {
            const keyLower = key.toLowerCase().replace(/[\s_-]/g, '')
            if (HIDDEN_KEYS.some(hk => keyLower === hk.toLowerCase().replace(/[\s_-]/g, ''))) return false
            if (keyLower.endsWith('id') && isUUID(value)) return false
            if (key === 'tindakan_terakhir') return false
            return true
        })
        if (filteredEntries.length === 0) return null
        return (
            <div className="mb-6">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">{title}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredEntries.map(([key, value]: any) => (
                        <div key={key} className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}</p>
                            <p className="text-xs font-bold text-slate-800">{typeof value === 'object' ? JSON.stringify(value) : (value?.toString() || '-')}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative pb-10">
            {/* Header Title Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Manajemen Tiket & Aduan</h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Kelola antrean aduan, disposisi unit kerja, dan tindak lanjut layanan secara tersentralisasi.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                        onClick={handleExportExcel}
                        disabled={isGenerating}
                        className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 px-4 py-2.5 text-xs rounded-xl font-extrabold transition-all disabled:opacity-50 shadow-xs"
                    >
                        <Download className="w-4 h-4 text-emerald-600" />
                        {isGenerating ? 'Memroses...' : 'Ekspor Excel'}
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={isGenerating}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs rounded-xl font-extrabold transition-all shadow-md disabled:opacity-50"
                    >
                        <FileText className="w-4 h-4 text-emerald-400" />
                        {isGenerating ? 'Memroses...' : 'Unduh PDF Formal'}
                    </button>
                </div>
            </div>

            {/* Formal PDF Export Config Panel */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm print:hidden flex flex-col lg:flex-row gap-4 items-center">
                <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 shrink-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Konfigurasi Dokumen Cetak:
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                    <input
                        type="date"
                        value={printDate}
                        onChange={(e) => setPrintDate(e.target.value)}
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Nama Penandatangan"
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <input
                        type="text"
                        value={signerRole}
                        onChange={(e) => setSignerRole(e.target.value)}
                        placeholder="Jabatan Penandatangan"
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 print:hidden">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/60 rounded-2xl overflow-x-auto">
                    {['Semua', 'Menunggu', 'Proses', 'Selesai'].map((tab) => {
                        const isActive = statusFilter === tab
                        const count = countStatus(tab)
                        return (
                            <button
                                key={tab}
                                onClick={() => setStatusFilter(tab)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0",
                                    isActive
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                                )}
                            >
                                <span>{tab}</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                                    isActive ? "bg-emerald-500 text-white" : "bg-slate-300/80 text-slate-700"
                                )}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[260px]">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari ID tiket, nama pelapor, unit..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Tickets Table Container */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden print:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50/80 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">ID Pelacakan</th>
                                <th className="px-6 py-4">Kategori & Tanggal</th>
                                <th className="px-6 py-4">Pelapor / Pemohon</th>
                                <th className="px-6 py-4">Unit Tujuan</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-semibold">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            <p>Memuat antrian tiket...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-semibold">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <Inbox className="w-10 h-10 text-slate-300 opacity-60" />
                                            <p className="font-bold text-slate-600 text-sm">Tidak ada tiket ditemukan</p>
                                            <p className="text-xs text-slate-400">Silakan sesuaikan filter pencarian atau kata kunci anda.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTickets.map((t: any) => (
                                    <tr
                                        key={t.id}
                                        onClick={() => handleOpenDetail(t)}
                                        className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4 font-mono font-bold text-slate-800">
                                            <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                                                {t.tracking_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-extrabold text-slate-800 uppercase tracking-wide">
                                                {t.jenis ? t.jenis.replace(/_/g, ' ') : 'PENGADUAN'}
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {new Date(t.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-700">
                                                {t.data_pelapor?.nama || t.data_payload?.nama || 'Anonim'}
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-semibold">
                                                {t.data_pelapor?.hp || t.data_payload?.hp || '-'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                <Building2 className="w-3 h-3 text-slate-400" />
                                                {t.units?.nama || 'Global'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                t.status === 'Selesai' ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                                    (t.status === 'Diproses' || t.status === 'Proses') ? "bg-purple-100 text-purple-800 border-purple-300" :
                                                        "bg-amber-100 text-amber-800 border-amber-300"
                                            )}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 group-hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-xs">
                                                <span>Kelola</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Printable Formal Document */}
            <div className="hidden print:block bg-white p-0 mx-auto max-w-[210mm] w-[100%] min-h-[297mm]">
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

                <div className="text-center mb-6 text-black">
                    <h3 className="text-sm font-bold uppercase underline underline-offset-4">Dokumen Rekam Data Tiket Mutu Eksternal / Internal</h3>
                    <p className="text-xs mt-1">Tanggal Cetak Dokumen: {new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>

                <div className="flex border border-black mb-6 text-black">
                    <div className="flex-1 p-3 flex flex-col justify-center items-center font-bold">
                        <p className="text-[10px] uppercase text-center mb-1">Total Data</p>
                        <h4 className="text-xl text-center">{tickets.length}</h4>
                    </div>
                </div>

                <div className="font-sans text-black">
                    <p className="text-xs font-bold uppercase mb-2">Metadata Tiket:</p>
                    <table className="w-full text-[10px] text-left border-collapse border border-black">
                        <thead className="bg-slate-100 font-bold">
                            <tr>
                                <th className="border border-black p-1.5 text-center w-8">No</th>
                                <th className="border border-black p-1.5 w-24">ID Tiket</th>
                                <th className="border border-black p-1.5 w-24">Tanggal</th>
                                <th className="border border-black p-1.5">Kategori</th>
                                <th className="border border-black p-1.5">Unit Tujuan</th>
                                <th className="border border-black p-1.5">Pengirim</th>
                                <th className="border border-black p-1.5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.length === 0 && (
                                <tr><td colSpan={7} className="p-4 text-center italic">Memuat data atau data kosong...</td></tr>
                            )}
                            {tickets.map((row, index) => (
                                <tr key={row.id}>
                                    <td className="border border-black p-1.5 text-center">{index + 1}</td>
                                    <td className="border border-black p-1.5 text-center font-mono">{row.tracking_number}</td>
                                    <td className="border border-black p-1.5">{new Date(row.created_at).toLocaleDateString('id-ID')}</td>
                                    <td className="border border-black p-1.5 font-bold uppercase">{row.jenis.replace(/_/g, ' ')}</td>
                                    <td className="border border-black p-1.5">{row.units?.nama || 'Global'}</td>
                                    <td className="border border-black p-1.5">{row.data_pelapor?.nama || row.data_payload?.nama || 'Anonim'}</td>
                                    <td className="border border-black p-1.5 text-center">{row.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-12 flex justify-end text-black font-sans break-inside-avoid">
                    <div className="text-center w-64">
                        <p className="text-xs mb-16">Kota Sejahtera, {new Date(printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-xs font-bold underline underline-offset-2">{signerName}</p>
                        <p className="text-[10px] mt-1">{signerRole}</p>
                    </div>
                </div>
            </div>

            {/* Slide-over Detail & Response Modal */}
            <AnimatePresence>
                {isDetailOpen && selectedTicket && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDetailOpen(false)}
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:pl-72 print:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0.5 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full lg:right-0 lg:left-auto pt-16 lg:pt-0 print:hidden"
                        >
                            {/* Slide-over Header */}
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-black text-sm uppercase tracking-wider text-white">Detail Tiket Aduan</h2>
                                        <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                            {selectedTicket.tracking_number}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 capitalize font-medium">
                                        {selectedTicket.jenis.replace(/_/g, ' ')} • {new Date(selectedTicket.created_at).toLocaleString('id-ID')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsDetailOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Slide-over Content Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Highlighted Complaint Content */}
                                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 shadow-xs">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold">
                                            <MessageSquare className="w-4 h-4" />
                                        </div>
                                        <h4 className="font-black text-emerald-950 text-xs uppercase tracking-wider">Uraian / Catatan Aduan Original</h4>
                                    </div>
                                    <div className="bg-white/80 p-4 rounded-xl border border-emerald-200/60 shadow-xs">
                                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                                            "{selectedTicket.data_payload?.deskripsi ||
                                                selectedTicket.data_payload?.kronologi ||
                                                selectedTicket.data_payload?.uraian ||
                                                selectedTicket.data_aduan?.deskripsi ||
                                                selectedTicket.data_payload?.feedback ||
                                                'Tidak ada catatan tertulis.'}"
                                        </p>
                                    </div>
                                </div>

                                {/* Structured Metadata Sections */}
                                <div className="space-y-4">
                                    {renderDataSection('Data Pemohon / Pelapor', selectedTicket.data_pelapor)}
                                    {renderDataSection('Data Kejadian', selectedTicket.data_kejadian)}
                                    {renderDataSection('Detail Aduan', selectedTicket.data_aduan)}
                                    {selectedTicket.data_payload && renderDataSection('Informasi Form Payload', selectedTicket.data_payload)}
                                </div>

                                {/* History Timeline */}
                                <div className="pt-4 border-t border-slate-200">
                                    <h4 className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider mb-4">
                                        <HistoryIcon className="w-4 h-4 text-emerald-500" /> Riwayat Respon & Disposisi
                                    </h4>
                                    <div className="space-y-3">
                                        {ticketHistory.length === 0 ? (
                                            <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                <p className="text-xs text-slate-400 font-medium">Belum ada catatan riwayat tindak lanjut.</p>
                                            </div>
                                        ) : (
                                            ticketHistory.map((h) => (
                                                <div key={h.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                                                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                                                        <span>{h.units?.nama || 'Admin'}</span>
                                                        <span>{new Date(h.updated_at).toLocaleString('id-ID')}</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-800">{h.notes}</p>
                                                    <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                                        {h.status}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Response Form Footer */}
                            <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0 space-y-4">
                                <div className="flex gap-2 p-1 bg-slate-200/80 rounded-xl">
                                    <button
                                        onClick={() => setActionForm({ ...actionForm, actionType: 'respon' })}
                                        className={cn("flex-1 py-2 text-xs font-extrabold rounded-lg transition-all", actionForm.actionType === 'respon' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
                                    >
                                        Respon Biasa
                                    </button>
                                    <button
                                        onClick={() => setActionForm({ ...actionForm, actionType: 'eskalasi' })}
                                        className={cn("flex-1 py-2 text-xs font-extrabold rounded-lg transition-all", actionForm.actionType === 'eskalasi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
                                    >
                                        Eskalasi Unit
                                    </button>
                                </div>

                                {actionForm.actionType === 'eskalasi' && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Pilih Unit Eskalasi</label>
                                        <select
                                            value={actionForm.eskalasi_unit_id}
                                            onChange={e => setActionForm({ ...actionForm, eskalasi_unit_id: e.target.value })}
                                            className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none"
                                        >
                                            <option value="">- Pilih Unit Kerja -</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Catatan Tindak Lanjut</label>
                                    <textarea
                                        value={actionForm.catatan}
                                        onChange={e => setActionForm({ ...actionForm, catatan: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        placeholder="Tuliskan respon resmi atau catatan..."
                                        rows={3}
                                    />
                                </div>

                                {/* Status Radio Buttons */}
                                <div className="flex gap-4 items-center">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="statusUpdate"
                                            value="eskalasi"
                                            checked={actionForm.statusUpdate === 'eskalasi'}
                                            onChange={() => setActionForm({ ...actionForm, statusUpdate: 'eskalasi' })}
                                            className="accent-emerald-600"
                                        />
                                        Set Diproses
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="statusUpdate"
                                            value="selesai"
                                            checked={actionForm.statusUpdate === 'selesai'}
                                            onChange={() => setActionForm({ ...actionForm, statusUpdate: 'selesai' })}
                                            className="accent-emerald-600"
                                        />
                                        Set Selesai
                                    </label>
                                </div>

                                <button
                                    disabled={isUpdating}
                                    onClick={handleExecuteAction}
                                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {isUpdating ? 'Menyimpan...' : 'Simpan & Kirim Tindakan'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
