'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    QrCode, Download, Printer, ExternalLink, Building2, Check,
    Sparkles, ShieldCheck, Heart, MessageSquare, Info, Filter,
    Search, Copy, CheckCircle2, RefreshCw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import { fetchAppSettings } from '@/utils/appSettings'

type QRType = 'all' | 'survei' | 'komplain' | 'informasi'

export default function MasterQRCodePage() {
    const [units, setUnits] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedUnit, setSelectedUnit] = useState<any>(null)
    const [qrType, setQrType] = useState<QRType>('all')
    const [qrDataUrl, setQrDataUrl] = useState<string>('')
    const [searchQuery, setSearchQuery] = useState('')
    const [copied, setCopied] = useState(false)
    const [appSettings, setAppSettings] = useState({
        kop_nama: 'Pemerintah Kota Sejahtera',
        kop_rs: 'Rumah Sakit Umum Daerah',
        kop_alamat: 'Jl. Jend. Sudirman No. 123',
        kop_kontak: 'Email: rsud@sejahtera.go.id',
        app_logo: '',
        app_name: 'PUAS'
    })

    const supabase = createClient()

    useEffect(() => {
        const initData = async () => {
            setIsLoading(true)
            const [settings, unitsRes] = await Promise.all([
                fetchAppSettings(supabase),
                supabase.from('units').select('*').order('nama', { ascending: true })
            ])

            if (settings) {
                setAppSettings({
                    kop_nama: settings.kop_nama,
                    kop_rs: settings.kop_rs,
                    kop_alamat: settings.kop_alamat,
                    kop_kontak: settings.kop_kontak,
                    app_logo: settings.app_logo,
                    app_name: settings.app_name || 'PUAS'
                })
            }

            if (unitsRes.data && unitsRes.data.length > 0) {
                setUnits(unitsRes.data)
                setSelectedUnit(unitsRes.data[0])
            }
            setIsLoading(false)
        }
        initData()
    }, [])

    // URL Generator
    const generateTargetUrl = (unit: any, type: QRType) => {
        if (!unit) return ''
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
        const unitParam = `unitId=${encodeURIComponent(unit.id)}&lockUnit=true`

        switch (type) {
            case 'survei':
                return `${baseUrl}/survei?${unitParam}`
            case 'komplain':
                return `${baseUrl}/komplain?${unitParam}`
            case 'informasi':
                return `${baseUrl}/informasi?${unitParam}`
            case 'all':
            default:
                return `${baseUrl}/?${unitParam}`
        }
    }

    const currentUrl = selectedUnit ? generateTargetUrl(selectedUnit, qrType) : ''

    // Generate QR Data URL whenever selectedUnit or qrType changes
    useEffect(() => {
        if (!currentUrl) return
        QRCode.toDataURL(currentUrl, {
            width: 500,
            margin: 2,
            color: {
                dark: '#0f172a', // Slate 900
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        })
            .then(url => setQrDataUrl(url))
            .catch(err => console.error('QR Generate Error:', err))
    }, [currentUrl])

    // Copy Link
    const handleCopyLink = () => {
        if (!currentUrl) return
        navigator.clipboard.writeText(currentUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Download QR Code Image (PNG)
    const handleDownloadPNG = () => {
        if (!qrDataUrl || !selectedUnit) return
        const link = document.createElement('a')
        link.href = qrDataUrl
        const cleanName = selectedUnit.nama.replace(/[^a-zA-Z0-9]/g, '_')
        link.download = `QRCode_${qrType.toUpperCase()}_${cleanName}.png`
        link.click()
    }

    // Download / Cetak Kartu Display Meja Akrilik (PDF Resmi A4/A5)
    const handleDownloadStandCardPDF = async () => {
        if (!qrDataUrl || !selectedUnit) return

        const { default: jsPDF } = await import('jspdf')
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pageWidth = doc.internal.pageSize.width
        const pageHeight = doc.internal.pageSize.height
        const margin = 16

        // 1. Decorative Outer Border Frame (Modern Executive Dual Frame)
        doc.setDrawColor(15, 23, 42)
        doc.setLineWidth(1.4)
        doc.roundedRect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2, 4, 4, 'S')

        doc.setDrawColor(13, 148, 136) // teal inner line
        doc.setLineWidth(0.6)
        doc.roundedRect(margin + 2.5, margin + 2.5, pageWidth - margin * 2 - 5, pageHeight - margin * 2 - 5, 3, 3, 'S')

        // Corner decorative accent notches
        const cLen = 7
        doc.setDrawColor(16, 185, 129) // emerald
        doc.setLineWidth(1.2)
        // Top-left
        doc.line(margin + 4, margin + 4, margin + 4 + cLen, margin + 4)
        doc.line(margin + 4, margin + 4, margin + 4, margin + 4 + cLen)
        // Top-right
        doc.line(pageWidth - margin - 4 - cLen, margin + 4, pageWidth - margin - 4, margin + 4)
        doc.line(pageWidth - margin - 4, margin + 4, pageWidth - margin - 4, margin + 4 + cLen)
        // Bottom-left
        doc.line(margin + 4, pageHeight - margin - 4, margin + 4 + cLen, pageHeight - margin - 4)
        doc.line(margin + 4, pageHeight - margin - 4, margin + 4, pageHeight - margin - 4 - cLen)
        // Bottom-right
        doc.line(pageWidth - margin - 4 - cLen, pageHeight - margin - 4, pageWidth - margin - 4, pageHeight - margin - 4)
        doc.line(pageWidth - margin - 4, pageHeight - margin - 4, pageWidth - margin - 4, pageHeight - margin - 4 - cLen)

        // 2. KOP SURAT ATAS
        let y = margin + 8

        if (appSettings.app_logo && appSettings.app_logo.startsWith('data:image')) {
            try {
                // White circular/rounded container for crisp contrast
                doc.setFillColor(255, 255, 255)
                doc.roundedRect(pageWidth / 2 - 13, y, 26, 26, 4, 4, 'F')
                doc.addImage(appSettings.app_logo, 'PNG', pageWidth / 2 - 11, y + 2, 22, 22)
                y += 29
            } catch (e) {
                y += 4
            }
        } else {
            y += 4
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(71, 85, 105)
        doc.text(appSettings.kop_nama.toUpperCase(), pageWidth / 2, y, { align: 'center' })
        y += 5.5

        doc.setFontSize(16)
        doc.setTextColor(15, 23, 42)
        doc.text(appSettings.kop_rs.toUpperCase(), pageWidth / 2, y, { align: 'center' })
        y += 5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(100, 116, 139)
        doc.text(appSettings.kop_alamat, pageWidth / 2, y, { align: 'center' })
        y += 7

        // Double Separator Line (Navy + Teal)
        doc.setDrawColor(15, 23, 42)
        doc.setLineWidth(0.8)
        doc.line(margin + 8, y, pageWidth - margin - 8, y)
        y += 1
        doc.setDrawColor(13, 148, 136)
        doc.setLineWidth(0.3)
        doc.line(margin + 8, y, pageWidth - margin - 8, y)
        y += 12

        // 3. JUDUL LAYANAN & BADGE PILL
        let serviceTitle = 'KANAL LAYANAN TERPADU'
        let serviceDesc = 'Pengaduan Pasien, Survei Kepuasan (IKM), & Permintaan Informasi'
        let badgeBg: [number, number, number] = [15, 23, 42]

        if (qrType === 'survei') {
            serviceTitle = 'SURVEI KEPUASAN MASYARAKAT (IKM)'
            serviceDesc = 'Evaluasi Pelayanan Berdasarkan Permenpan RB No. 14 Tahun 2017'
            badgeBg = [225, 29, 72] // rose
        } else if (qrType === 'komplain') {
            serviceTitle = 'KANAL PENGADUAN & KELUHAN LAYANAN'
            serviceDesc = 'Sampaikan Keluhan Anda untuk Perbaikan Layanan Cepat & Akuntabel'
            badgeBg = [217, 119, 6] // amber
        } else if (qrType === 'informasi') {
            serviceTitle = 'PERMINTAAN INFORMASI PUBLIK'
            serviceDesc = 'Akses Informasi Pelayanan & Tata Kelola Terbuka'
            badgeBg = [37, 99, 235] // blue
        }

        // Stylish Badge pill with text 'SILAKAN PINDAI KODE QR '
        const badgeW = 88
        const badgeH = 8
        doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2])
        doc.roundedRect(pageWidth / 2 - badgeW / 2, y, badgeW, badgeH, 4, 4, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(255, 255, 255)
        doc.text('SILAKAN PINDAI KODE QR ', pageWidth / 2, y + 5.5, { align: 'center' })
        y += 15

        // Unit Name Highlight (Bold & Modern)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(22)
        doc.setTextColor(15, 23, 42)
        doc.text(selectedUnit.nama.toUpperCase(), pageWidth / 2, y, { align: 'center' })
        y += 6.5

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(13, 148, 136)
        doc.text(serviceTitle, pageWidth / 2, y, { align: 'center' })
        y += 4.5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(serviceDesc, pageWidth / 2, y, { align: 'center' })
        y += 10

        // 4. QR CODE IMAGE BOX WITH HIGH-TECH CORNER BRACKETS
        const qrSize = 88
        const qrBoxX = (pageWidth - qrSize) / 2

        // Clean background card with subtle elevation
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.4)
        doc.roundedRect(qrBoxX - 5, y - 5, qrSize + 10, qrSize + 10, 4, 4, 'FD')

        doc.addImage(qrDataUrl, 'PNG', qrBoxX, y, qrSize, qrSize)

        // Scanner Corner Target Brackets (Teal)
        const bLen = 8
        doc.setDrawColor(13, 148, 136)
        doc.setLineWidth(1.2)
        // Top-left
        doc.line(qrBoxX - 2, y - 2, qrBoxX - 2 + bLen, y - 2)
        doc.line(qrBoxX - 2, y - 2, qrBoxX - 2, y - 2 + bLen)
        // Top-right
        doc.line(qrBoxX + qrSize + 2 - bLen, y - 2, qrBoxX + qrSize + 2, y - 2)
        doc.line(qrBoxX + qrSize + 2, y - 2, qrBoxX + qrSize + 2, y - 2 + bLen)
        // Bottom-left
        doc.line(qrBoxX - 2, y + qrSize + 2, qrBoxX - 2 + bLen, y + qrSize + 2)
        doc.line(qrBoxX - 2, y + qrSize + 2, qrBoxX - 2, y + qrSize + 2 - bLen)
        // Bottom-right
        doc.line(qrBoxX + qrSize + 2 - bLen, y + qrSize + 2, qrBoxX + qrSize + 2, y + qrSize + 2)
        doc.line(qrBoxX + qrSize + 2, y + qrSize + 2, qrBoxX + qrSize + 2, y + qrSize + 2 - bLen)

        y += qrSize + 14

        // 5. INSTRUCTION & FOOTER
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(15, 23, 42)
        doc.text('PETUNJUK PENGGUNAAN:', pageWidth / 2, y, { align: 'center' })
        y += 5.5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(71, 85, 105)
        doc.text('1. Buka kamera ponsel pintar atau aplikasi pemindai QR Code Anda.', pageWidth / 2, y, { align: 'center' })
        y += 4.5
        doc.text('2. Arahkan lensa ke kode QR di atas hingga tautan terdeteksi.', pageWidth / 2, y, { align: 'center' })
        y += 4.5
        doc.text(`3. Formulir layanan akan terbuka secara otomatis khusus untuk unit ${selectedUnit.nama}.`, pageWidth / 2, y, { align: 'center' })
        y += 11

        // Guarantee Tagline
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(13, 148, 136)
        doc.text('Aspirasi & Masukan Anda Sangat Berharga Demi Peningkatan Mutu Pelayanan', pageWidth / 2, pageHeight - margin - 8, { align: 'center' })

        const cleanName = selectedUnit.nama.replace(/[^a-zA-Z0-9]/g, '_')
        doc.save(`Stand_QR_${qrType.toUpperCase()}_${cleanName}.pdf`)
    }

    const filteredUnits = useMemo(() => {
        const q = searchQuery.toLowerCase().trim()
        if (!q) return units
        return units.filter(u => (u.nama || '').toLowerCase().includes(q))
    }, [units, searchQuery])

    const QR_TYPES: { id: QRType; title: string; desc: string; icon: any; color: string; bg: string }[] = [
        {
            id: 'all',
            title: 'Gabungan (Semua Layanan)',
            desc: 'Portal utama memuat Survei, Aduan, dan Informasi khusus unit ini',
            icon: QrCode,
            color: 'text-slate-900',
            bg: 'bg-slate-100 border-slate-300'
        },
        {
            id: 'survei',
            title: 'Survei Kepuasan (IKM)',
            desc: 'Langsung membuka kuesioner IKM 11 unsur dengan unit terkunci',
            icon: Heart,
            color: 'text-rose-600',
            bg: 'bg-rose-50 border-rose-200'
        },
        {
            id: 'komplain',
            title: 'Kanal Aduan / Komplain',
            desc: 'Langsung membuka formulir pelaporan aduan pasien/masyarakat',
            icon: MessageSquare,
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-200'
        },
        {
            id: 'informasi',
            title: 'Permintaan Informasi',
            desc: 'Langsung membuka formulir permohonan informasi publik',
            icon: Info,
            color: 'text-blue-600',
            bg: 'bg-blue-50 border-blue-200'
        }
    ]

    return (
        <div className="space-y-6 relative font-sans">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <QrCode className="w-8 h-8 text-emerald-600" />
                        Master QR Code Unit Kerja
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">
                        Generator QR Code pintar per unit kerja untuk formulir Aduan, Survei IKM, Informasi, atau Gabungan dengan unit otomatis terkunci.
                    </p>
                </div>

                {selectedUnit && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadPNG}
                            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                            title="Unduh gambar QR Code dalam format PNG"
                        >
                            <Download className="w-4 h-4 text-emerald-600" />
                            <span>Unduh PNG</span>
                        </button>
                        <button
                            onClick={handleDownloadStandCardPDF}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                            title="Unduh file siap cetak untuk kartu akrilik stand meja"
                        >
                            <Printer className="w-4 h-4 text-emerald-400" />
                            <span>Cetak Stand Meja (PDF)</span>
                        </button>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-3">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold text-xs">Memuat data unit kerja...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* SISI KIRI: DAFTAR UNIT KERJA (PILIHAN) */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/90 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-emerald-600" /> Pilih Unit Kerja
                                </h3>
                                <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {units.length} Unit
                                </span>
                            </div>

                            {/* Search box */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari nama unit..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            {/* List of Units */}
                            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
                                {filteredUnits.map((u) => {
                                    const isSelected = selectedUnit?.id === u.id
                                    return (
                                        <button
                                            key={u.id}
                                            onClick={() => setSelectedUnit(u)}
                                            className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${isSelected
                                                ? 'bg-emerald-50 text-emerald-950 border-emerald-300 shadow-xs'
                                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100'
                                                }`}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="text-xs font-extrabold truncate">{u.nama}</p>
                                                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                                    {u.deskripsi || 'Unit Pelayanan'}
                                                </p>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* SISI KANAN: GENERATOR & PRATINJAU QR CODE */}
                    <div className="lg:col-span-8 space-y-5">
                        {/* 1. Pilihan Jenis Layanan QR */}
                        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/90 space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <Filter className="w-4 h-4 text-blue-600" />
                                Tipe / Peruntukan QR Code:
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {QR_TYPES.map((t) => {
                                    const isCurrent = qrType === t.id
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setQrType(t.id)}
                                            className={`p-3.5 rounded-2xl text-left border transition-all flex items-start gap-3 ${isCurrent
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                : 'bg-slate-50/70 hover:bg-slate-50 text-slate-700 border-slate-200/80'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${isCurrent ? 'bg-white/10 text-white' : `${t.bg} ${t.color}`}`}>
                                                <t.icon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black">{t.title}</p>
                                                <p className={`text-[10px] mt-0.5 leading-snug ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                                                    {t.desc}
                                                </p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 2. Visual Card Pratinjau QR Code */}
                        {selectedUnit && (
                            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/90 space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Unit Terpilih
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">• Unit Terkunci Otomatis</span>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mt-1">{selectedUnit.nama}</h3>
                                    </div>
                                    <span className="text-xs font-black px-3 py-1 bg-slate-100 text-slate-800 rounded-full border border-slate-200">
                                        Mode: {QR_TYPES.find(t => t.id === qrType)?.title}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                    {/* Visual Box QR Code */}
                                    <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-3xl border border-slate-200/80">
                                        {qrDataUrl ? (
                                            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-100 flex flex-col items-center">
                                                <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 object-contain" />
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mt-2">
                                                    Pindai untuk Akses Langsung
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="w-52 h-52 flex items-center justify-center text-slate-400 font-bold text-xs">
                                                Menghasilkan QR...
                                            </div>
                                        )}
                                    </div>

                                    {/* Detail Info & Link Controller */}
                                    <div className="md:col-span-7 space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                                Tautan Tujuan (Otomatis Mengunci Unit):
                                            </label>
                                            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={currentUrl}
                                                    className="w-full bg-transparent text-xs font-mono font-bold text-slate-700 outline-none truncate"
                                                />
                                                <button
                                                    onClick={handleCopyLink}
                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors shrink-0 flex items-center gap-1"
                                                >
                                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                    <span>{copied ? 'Tersalin' : 'Salin'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-900 space-y-1.5">
                                            <div className="flex items-center gap-1.5 font-black text-emerald-800">
                                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                                <span>Keamanan & Proteksi Unit Kerja Terkunci:</span>
                                            </div>
                                            <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                                                Saat masyarakat memindai QR Code ini, formulir akan otomatis terisi dengan <strong>{selectedUnit.nama}</strong> dan dropdown unit <strong>otomatis terkunci</strong> sehingga responden tidak dapat memilih unit lain.
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="pt-2 flex flex-wrap gap-2.5">
                                            <a
                                                href={currentUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                                            >
                                                <ExternalLink className="w-4 h-4 text-blue-600" />
                                                <span>Uji Coba Tautan</span>
                                            </a>
                                            <button
                                                onClick={handleDownloadPNG}
                                                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                                            >
                                                <Download className="w-4 h-4 text-emerald-600" />
                                                <span>Unduh File Gambar (PNG)</span>
                                            </button>
                                            <button
                                                onClick={handleDownloadStandCardPDF}
                                                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                                            >
                                                <Printer className="w-4 h-4 text-emerald-400" />
                                                <span>Cetak Stand Meja (PDF)</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

