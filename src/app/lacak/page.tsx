'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Search, CheckCircle2, Clock, MapPin, Inbox, ShieldCheck, Copy, Phone, MessageCircle, ArrowUpRight, FileText, Building2, History as HistoryIcon, Download, FileDown, MessageSquareQuote, MessageSquare } from 'lucide-react'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings } from '@/utils/appSettings'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import AppFooter from '@/components/AppFooter'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/utils/cn'
import { createClient } from '@/utils/supabase/client'

const STEPS = [
    { id: 'Terkirim', label: 'Laporan Diterima', desc: 'Laporan berhasil tercatat dalam sistem', icon: Inbox, color: 'from-blue-500 to-indigo-600' },
    { id: 'Diverifikasi', label: 'Diverifikasi', desc: 'Telah diverifikasi dan diteruskan ke unit terkait', icon: ShieldCheck, color: 'from-violet-500 to-purple-600' },
    { id: 'Diproses', label: 'Sedang Diproses', desc: 'Petugas sedang menindaklanjuti laporan', icon: Clock, color: 'from-amber-500 to-orange-600' },
    { id: 'Selesai', label: 'Selesai', desc: 'Penanganan telah diselesaikan', icon: CheckCircle2, color: 'from-emerald-500 to-green-600' }
]

export default function LacakPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-slate-200 border-t-accent rounded-full animate-spin" /></div>}>
            <LacakContent />
        </Suspense>
    )
}

function LacakContent() {
    const searchParams = useSearchParams()
    const initialNomor = searchParams.get('nomor') || ''

    const [trackingNumber, setTrackingNumber] = useState(initialNomor)
    const [isSearching, setIsSearching] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])
    const [copied, setCopied] = useState(false)
    const [whatsappKontak, setWhatsappKontak] = useState('')
    const [appSettings, setAppSettings] = useState({
        kop_nama: '',
        kop_rs: '',
        kop_alamat: '',
        kop_kontak: '',
        nama_penandatangan: '',
        jabatan_penandatangan: '',
        app_logo: ''
    })

    // Simulation: Auto search if param exists
    useEffect(() => {
        // Fetch whatsapp kontak from settings
        const loadSettings = async () => {
            const supabase = createClient()
            const settings = await fetchAppSettings(supabase)
            setWhatsappKontak(settings.whatsapp_kontak)
            setAppSettings({
                kop_nama: settings.kop_nama,
                kop_rs: settings.kop_rs,
                kop_alamat: settings.kop_alamat,
                kop_kontak: settings.kop_kontak,
                nama_penandatangan: settings.nama_penandatangan,
                jabatan_penandatangan: settings.jabatan_penandatangan,
                app_logo: settings.app_logo
            })
        }
        loadSettings()
        if (initialNomor) handleSearch(undefined, initialNomor)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSearch = async (e?: React.FormEvent, directNumber?: string) => {
        e?.preventDefault()
        const num = directNumber || trackingNumber
        if (!num) return

        setIsSearching(true)
        setResult(null)

        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('tickets')
                .select('*, units!unit_id(nama)')
                .eq('tracking_number', num.toUpperCase())
                .single()

            if (error || !data) {
                setResult('not_found')
                setHistory([])
            } else {
                setResult({
                    id: data.id,
                    nomor: data.tracking_number,
                    status: data.status,
                    jenis: data.jenis.replace('_', ' '),
                    tanggal: new Date(data.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    tanggal_raw: data.created_at,
                    unit: data.units?.nama || 'Global',
                    catatan: data.data_payload?.tindakan_terakhir?.catatan || null,
                    tindakan: data.data_payload?.tindakan_terakhir || null,
                    updated_at: data.updated_at
                })

                // Fetch Detailed History
                const { data: historyData } = await supabase
                    .from('ticket_history')
                    .select('*, units!from_unit_id(nama)')
                    .eq('ticket_id', data.id)
                    .order('updated_at', { ascending: true })

                setHistory(historyData || [])
            }
        } catch (err) {
            setResult('not_found')
        } finally {
            setIsSearching(false)
        }
    }

    const getStepIndex = (status: string) => {
        return STEPS.findIndex(s => s.id === status)
    }

    const handleCopy = () => {
        if (result && result.nomor) {
            navigator.clipboard.writeText(result.nomor)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const getProgressPercent = () => {
        if (!result || result === 'not_found') return 0;
        const idx = getStepIndex(result.status)
        return ((idx + 1) / STEPS.length) * 100
    }

    const getWhatsappUrl = () => {
        if (!whatsappKontak) return '#'
        const number = whatsappKontak.replace(/\D/g, '').startsWith('0') ? '62' + whatsappKontak.replace(/\D/g, '').slice(1) : whatsappKontak.replace(/\D/g, '')
        const text = result && result !== 'not_found'
            ? `Halo, saya ingin menanyakan status tiket saya dengan nomor: ${result.nomor}. Status saat ini: ${result.status}`
            : 'Halo, saya ingin menanyakan status tiket saya.'
        return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
    }

    const handleDownloadReport = () => {
        if (!result || result === 'not_found') return;

        const tableData = [
            ['ID Tiket', result.nomor],
            ['Jenis Layanan', result.jenis.toUpperCase()],
            ['Tanggal Masuk', result.tanggal],
            ['Unit Penanggung Jawab', result.unit],
            ['Status Akhir', result.status.toUpperCase()]
        ];

        const historyTableData = history.map((h, idx) => [
            idx + 1,
            new Date(h.updated_at).toLocaleString('id-ID'),
            h.units?.nama || 'Admin/Sistem',
            h.notes || '-'
        ]);

        generateFormalPDF({
            title: 'LAPORAN REKAPITULASI PELACAKAN TIKET',
            subtitle: `Nomor Tracking: ${result.nomor}`,
            filename: `Laporan_Lacak_${result.nomor}.pdf`,
            appSettings: {
                kop_nama: appSettings.kop_nama,
                kop_rs: appSettings.kop_rs,
                kop_alamat: appSettings.kop_alamat,
                kop_kontak: appSettings.kop_kontak
            },
            printDate: new Date().toISOString(),
            signerName: appSettings.nama_penandatangan,
            signerRole: appSettings.jabatan_penandatangan,
            tableHeaders: ['Kategori', 'Detail Informasi'],
            tableData: tableData,
            additionalInfo: ['Berikut adalah rincian histori penanganan tiket Anda:', ''],
            additionalInfoBottom: ['', 'Log Histori Penanganan:'],
            tableHeadersBottom: ['No', 'Waktu', 'Unit Kerja', 'Catatan Penanganan'],
            tableDataBottom: historyTableData
        });
    }

    return (
        <main className="min-h-screen pb-24 bg-gradient-to-b from-slate-50 to-slate-100 relative">
            {/* Hero Header */}
            <div className="relative w-full overflow-hidden bg-slate-900 rounded-b-[2.5rem] pt-14 pb-14 px-6 shadow-xl text-white">
                <Link href="/" className="absolute top-6 left-6 z-20 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 shadow-sm hover:bg-white/20 transition-all">
                    <ChevronLeft className="w-6 h-6" />
                </Link>

                {/* Dynamic gradient blobs */}
                <div
                    className="absolute top-0 right-0 w-[150%] h-[150%] bg-gradient-to-bl from-accent/80 to-primary/80 rounded-full"
                    style={{ transform: 'translate(40%, -50%) rotate(-15deg)', filter: 'blur(40px)', opacity: 0.8 }}
                />
                <div
                    className="absolute bottom-0 left-0 w-[80%] h-[80%] bg-gradient-to-tr from-emerald-500/30 to-cyan-500/30 rounded-full"
                    style={{ transform: 'translate(-40%, 50%)', filter: 'blur(60px)', opacity: 0.5 }}
                />

                <div className="relative z-10 flex flex-col items-center text-center mt-4">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                        className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm border border-white/20 shadow-lg"
                    >
                        <MapPin className="w-8 h-8 text-white" />
                    </motion.div>
                    <motion.h1
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="text-3xl font-extrabold tracking-tight drop-shadow-sm mb-1"
                    >
                        Lacak Tiket
                    </motion.h1>
                    <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-sm font-medium text-slate-200 drop-shadow-sm max-w-xs"
                    >
                        Pantau status penanganan laporan Anda secara real-time.
                    </motion.p>

                    <motion.form
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        onSubmit={handleSearch}
                        className="w-full max-w-sm mt-8 relative"
                    >
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                            placeholder="Masukkan Nomor Tiket..."
                            className="w-full pl-5 pr-14 py-4 rounded-2xl bg-white text-black font-bold focus:outline-none focus:ring-4 focus:ring-accent/30 shadow-lg placeholder:text-slate-400"
                        />
                        <button
                            disabled={isSearching || !trackingNumber}
                            type="submit"
                            className="absolute right-2 top-2 bottom-2 aspect-square bg-gradient-to-br from-accent to-emerald-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                        >
                            {isSearching
                                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Search className="w-5 h-5 pointer-events-none" />
                            }
                        </button>
                    </motion.form>
                </div>
            </div>

            <div className="px-6 -mt-6 relative z-20 max-w-lg mx-auto">
                {/* Loading state */}
                <AnimatePresence>
                    {isSearching && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full rounded-3xl p-10 flex flex-col items-center justify-center bg-white shadow-xl border border-slate-100"
                        >
                            <div className="relative mb-5">
                                <div className="w-14 h-14 border-4 border-slate-100 border-t-accent rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Search className="w-5 h-5 text-slate-400" />
                                </div>
                            </div>
                            <p className="text-sm font-bold text-slate-600 animate-pulse">Mencari tiket di sistem...</p>
                            <p className="text-xs text-slate-400 mt-1">Mohon tunggu sebentar</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Not Found state */}
                <AnimatePresence>
                    {result === 'not_found' && !isSearching && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl bg-white mb-6 border border-red-100"
                        >
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 border border-red-100">
                                <Search className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Tiket Tidak Ditemukan</h3>
                            <p className="text-sm text-slate-500">Nomor tiket <strong className="text-red-500 font-mono">{trackingNumber}</strong> tidak dapat ditemukan di sistem.</p>
                            <p className="text-xs text-slate-400 mt-2">Periksa kembali nomor tiket Anda atau hubungi petugas.</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* RESULT - Modern tracking card */}
                <AnimatePresence>
                    {result && result !== 'not_found' && !isSearching && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full space-y-5"
                        >
                            {/* Ticket Info Card */}
                            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                                {/* Progress bar */}
                                <div className="relative h-2 bg-slate-100">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${getProgressPercent()}%` }}
                                        transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                                        className={cn(
                                            "absolute inset-y-0 left-0 rounded-r-full",
                                            result.status === 'Selesai'
                                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                                : 'bg-gradient-to-r from-accent to-primary'
                                        )}
                                    />
                                </div>

                                <div className="p-6">
                                    {/* Ticket Header */}
                                    <div className="flex justify-between items-start mb-5">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1 flex items-center gap-1.5">
                                                <FileText className="w-3 h-3" />
                                                {result.jenis}
                                            </p>
                                            <h3 className="text-2xl font-black text-black font-mono tracking-wider">{result.nomor}</h3>
                                            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {result.tanggal}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={cn(
                                                "px-3 py-1.5 text-xs font-extrabold rounded-xl border shadow-sm",
                                                result.status === 'Selesai' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    result.status === 'Diproses' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        result.status === 'Diverifikasi' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                                                            'bg-amber-50 text-amber-700 border-amber-200'
                                            )}>
                                                {result.status}
                                            </span>
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                <Building2 className="w-3 h-3" />
                                                {result.unit}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tracking Timeline */}
                                    <div className="relative mt-6">
                                        {/* Vertical line */}
                                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-slate-200 via-slate-100 to-transparent z-0 rounded-full" />

                                        <div className="space-y-1">
                                            {STEPS.map((step, idx) => {
                                                const currentIndex = getStepIndex(result.status)
                                                const isCompleted = idx <= currentIndex
                                                const isCurrent = idx === currentIndex
                                                const isPast = idx < currentIndex

                                                return (
                                                    <motion.div
                                                        key={step.id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: 0.4 + idx * 0.15 }}
                                                        className={cn(
                                                            "flex items-start gap-4 relative z-10 p-3 rounded-2xl transition-all duration-500",
                                                            isCurrent ? "bg-slate-50 border border-slate-100 shadow-sm" : "",
                                                            !isCompleted ? "opacity-30" : ""
                                                        )}
                                                    >
                                                        {/* Step indicator */}
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm border",
                                                            isCurrent
                                                                ? `bg-gradient-to-br ${step.color} text-white border-transparent shadow-lg`
                                                                : isPast
                                                                    ? "bg-emerald-100 text-emerald-600 border-emerald-200"
                                                                    : "bg-slate-100 text-slate-300 border-slate-200"
                                                        )}>
                                                            <step.icon className="w-5 h-5" />
                                                        </div>

                                                        <div className="flex-1 min-w-0 pt-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className={cn(
                                                                    "font-bold text-sm",
                                                                    isCompleted ? "text-black" : "text-slate-400"
                                                                )}>
                                                                    {step.label}
                                                                </h4>
                                                                {isCurrent && (
                                                                    <span className="relative flex h-2.5 w-2.5">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className={cn(
                                                                "text-xs mt-0.5",
                                                                isCompleted ? "text-slate-500" : "text-slate-300"
                                                            )}>{step.desc}</p>
                                                            {isCurrent && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 5 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: 1 }}
                                                                    className="mt-2 flex items-center gap-2"
                                                                >
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider rounded-lg border border-accent/20">
                                                                        <Clock className="w-3 h-3" />
                                                                        Status Saat Ini
                                                                    </span>
                                                                </motion.div>
                                                            )}
                                                            {isPast && isCompleted && (
                                                                <p className="text-[10px] text-emerald-500 font-bold mt-1 flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3" /> Selesai
                                                                </p>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Notes */}
                            {result.tindakan && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.8 }}
                                    className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden"
                                >
                                    <div className={cn("px-5 py-3 border-b flex items-center gap-2",
                                        result.tindakan.actionType === 'eskalasi' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100/60' :
                                            result.tindakan.actionType === 'lapor' ? 'bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100/60' :
                                                result.status === 'Selesai' ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-100/60' :
                                                    'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100/60'
                                    )}>
                                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                                            result.tindakan.actionType === 'eskalasi' ? 'bg-blue-100' :
                                                result.tindakan.actionType === 'lapor' ? 'bg-violet-100' :
                                                    result.status === 'Selesai' ? 'bg-emerald-100' :
                                                        'bg-amber-100'
                                        )}>
                                            {result.tindakan.actionType === 'eskalasi' ? <ArrowUpRight className="w-4 h-4 text-blue-600" /> :
                                                result.tindakan.actionType === 'lapor' ? <ShieldCheck className="w-4 h-4 text-violet-600" /> :
                                                    result.status === 'Selesai' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                                                        <MessageCircle className="w-4 h-4 text-amber-600" />}
                                        </div>
                                        <p className={cn("text-xs font-bold uppercase tracking-wide",
                                            result.tindakan.actionType === 'eskalasi' ? 'text-blue-800' :
                                                result.tindakan.actionType === 'lapor' ? 'text-violet-800' :
                                                    result.status === 'Selesai' ? 'text-emerald-800' :
                                                        'text-amber-800'
                                        )}>
                                            {result.tindakan.actionType === 'eskalasi' ? 'Tiket Dieskalasikan' :
                                                result.tindakan.actionType === 'lapor' ? 'Laporan ke Atasan' :
                                                    result.status === 'Selesai' ? 'Laporan Selesai' :
                                                        'Catatan Petugas'}
                                        </p>
                                    </div>
                                    <div className="p-5">
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                            "{result.catatan || 'Petugas telah menindaklanjuti laporan Anda.'}"
                                        </p>
                                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                    <Building2 className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Unit Penanganan</p>
                                                    <p className="text-xs font-bold text-slate-700">{result.unit}</p>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium italic">Diperbarui {new Date(result.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Audit Trail / History */}
                            {history.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.9 }}
                                    className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5"
                                >
                                    <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
                                        <HistoryIcon className="w-4 h-4 text-emerald-500" /> Histori Pelayanan
                                    </h4>
                                    <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-50 before:z-0">
                                        {history.map((item, idx) => (
                                            <div key={item.id} className="relative z-10 pl-8 pb-1">
                                                <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                                                <div>
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">{item.units?.nama || 'Petugas'}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold">{new Date(item.updated_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                    <p className="text-xs text-slate-600 font-medium mt-0.5 leading-relaxed">{item.notes}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* DOWNLOAD & NEXT ACTIONS */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1 }}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleDownloadReport}
                                        className="w-full py-4 bg-slate-900 border border-slate-800 text-white rounded-2xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                        <Download className="w-5 h-5" />
                                        Unduh Laporan
                                    </button>
                                </div>      {/* WhatsApp CS */}
                                {whatsappKontak && (
                                    <a
                                        href={getWhatsappUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/10 hover:bg-emerald-600 transition-all border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1"
                                    >
                                        <MessageSquare className="w-5 h-5" />
                                        Hubungi CS via WhatsApp
                                    </a>
                                )}
                            </motion.div>

                            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-6">
                                Terakhir Diperbarui: {new Date(result.updated_at).toLocaleString('id-ID')}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Empty state */}
                {!result && !isSearching && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="w-full text-center py-10"
                    >
                        <div className="w-20 h-20 mx-auto bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                            <MapPin className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">Masukkan Nomor Tiket</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Masukkan nomor pelacakan yang tertera di bukti laporan Anda untuk melihat status terkini.</p>
                    </motion.div>
                )}
            </div>

            <AppFooter />
            <BottomNav />
        </main>
    )
}
