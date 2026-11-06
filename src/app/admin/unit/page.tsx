'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Building2, Plus, Edit, Trash2, X, Save, CheckCircle2,
    AlertCircle, Search, Upload, Download, FileSpreadsheet, Check,
    FileText, ChevronDown, Printer
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import * as xlsx from 'xlsx'
import { generateFormalPDF } from '@/utils/pdfExport'
import { fetchAppSettings, DEFAULT_APP_SETTINGS, AppSettingsData } from '@/utils/appSettings'

export default function AdminUnitPage() {
    const [units, setUnits] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [formData, setFormData] = useState({ id: '', nama: '', deskripsi: '' })
    const [isSaving, setIsSaving] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [importedPreview, setImportedPreview] = useState<{ nama: string; deskripsi: string }[]>([])
    const [appSettings, setAppSettings] = useState<AppSettingsData>(DEFAULT_APP_SETTINGS)
    const [isExportOpen, setIsExportOpen] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const exportDropdownRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()
    const router = useRouter()

    const showToast = (type: 'success' | 'error', text: string) => {
        setSaveMessage({ type, text })
        setTimeout(() => setSaveMessage(null), 4000)
    }

    const fetchUnits = async () => {
        setIsLoading(true)
        const { data, error } = await supabase.from('units').select('*').order('nama', { ascending: true })
        if (error) {
            console.error('Error fetching units:', error)
            showToast('error', 'Gagal mengambil data unit: ' + error.message)
        }
        setUnits(data || [])
        setIsLoading(false)
    }

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
                if (profile?.role === 'user') {
                    return router.push('/admin/tiket')
                }
            }
            fetchUnits()
            const settings = await fetchAppSettings(supabase)
            if (settings) {
                setAppSettings(settings)
            }
        }
        checkAuth()

        const handleClickOutside = (e: MouseEvent) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
                setIsExportOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleOpenModal = (unit?: any) => {
        if (unit) {
            setFormData({ id: unit.id, nama: unit.nama, deskripsi: unit.deskripsi || '' })
        } else {
            setFormData({ id: '', nama: '', deskripsi: '' })
        }
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, nama: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus unit "${nama}"? Unit yang sudah digunakan di data lain tidak dapat dihapus.`)) return
        const { error } = await supabase.from('units').delete().eq('id', id)
        if (error) {
            if (error.message.includes('violates foreign key constraint')) {
                showToast('error', `Unit "${nama}" tidak dapat dihapus karena sudah memiliki riwayat tiket terkait.`)
            } else {
                showToast('error', 'Gagal menghapus: ' + error.message)
            }
        } else {
            showToast('success', `Unit "${nama}" berhasil dihapus.`)
            fetchUnits()
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.nama.trim()) {
            showToast('error', 'Nama unit tidak boleh kosong')
            return
        }
        setIsSaving(true)
        if (formData.id) {
            const { error } = await supabase.from('units').update({
                nama: formData.nama.trim(),
                deskripsi: formData.deskripsi.trim() || null
            }).eq('id', formData.id)
            if (error) {
                showToast('error', 'Gagal menyimpan: ' + error.message)
            } else {
                showToast('success', `Unit "${formData.nama}" berhasil diperbarui.`)
                setIsModalOpen(false)
                fetchUnits()
            }
        } else {
            const { error } = await supabase.from('units').insert({
                nama: formData.nama.trim(),
                deskripsi: formData.deskripsi.trim() || null
            })
            if (error) {
                showToast('error', 'Gagal menambah unit: ' + error.message)
            } else {
                showToast('success', `Unit "${formData.nama}" berhasil ditambahkan!`)
                setIsModalOpen(false)
                fetchUnits()
            }
        }
        setIsSaving(false)
    }

    // --- UNDUH TEMPLATE EXCEL (POIN 6) ---
    const handleDownloadTemplate = () => {
        const templateData = [
            {
                'Nama Unit Kerja': 'Instalasi Gawat Darurat (IGD)',
                'Deskripsi / Tugas Pokok': 'Pelayanan medis darurat 24 jam'
            },
            {
                'Nama Unit Kerja': 'Instalasi Rawat Jalan (Poliklinik)',
                'Deskripsi / Tugas Pokok': 'Pelayanan rawat jalan berbagai spesialisasi'
            },
            {
                'Nama Unit Kerja': 'Instalasi Farmasi & Obat',
                'Deskripsi / Tugas Pokok': 'Pelayanan resep obat dan perbekalan farmasi'
            },
            {
                'Nama Unit Kerja': 'Laboratorium & Radiologi',
                'Deskripsi / Tugas Pokok': 'Pemeriksaan diagnostik penunjang medis'
            },
            {
                'Nama Unit Kerja': 'Loket Pendaftaran & Kasir',
                'Deskripsi / Tugas Pokok': 'Administrasi admisi pasien dan pembayaran'
            }
        ]

        const worksheet = xlsx.utils.json_to_sheet(templateData)
        worksheet['!cols'] = [{ wch: 35 }, { wch: 45 }]
        const workbook = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(workbook, worksheet, "Template_Unit")
        xlsx.writeFile(workbook, "Template_Import_Unit_Kerja.xlsx")
        showToast('success', 'Template Excel berhasil diunduh.')
    }

    // --- UNDUH LAPORAN MASTER UNIT KERJA (PDF RESMI & EXCEL) ---
    const handleExportPDF = () => {
        setIsGenerating(true)
        setIsExportOpen(false)
        setTimeout(() => {
            const printDate = new Date().toISOString()
            const totalUnits = units.length
            const poliUnits = units.filter(u => (u.nama || '').toLowerCase().includes('poli') || (u.nama || '').toLowerCase().includes('rawat')).length
            const instalasiUnits = units.filter(u => (u.nama || '').toLowerCase().includes('instalasi')).length
            const otherUnits = totalUnits - poliUnits - instalasiUnits

            generateFormalPDF({
                title: 'LAPORAN MASTER DATA UNIT KERJA & RUANG LAYANAN',
                subtitle: `Daftar Resmi Inventaris Satuan Kerja, Poliklinik, dan Instalasi Terdaftar • ${appSettings.kop_rs}`,
                documentNumber: `PUAS/UNT/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${Math.floor(Math.random() * 900 + 100)}`,
                filename: `Laporan_Master_Unit_Kerja_${new Date().toISOString().slice(0, 10)}.pdf`,
                appSettings,
                printDate,
                signerName: appSettings.nama_penandatangan || 'dr. Rofi Irman, Sp.PD, FINASIM',
                signerRole: appSettings.jabatan_penandatangan || 'Direktur Utama',
                includeCoverPage: true,
                kpiCards: [
                    { title: 'Total Unit Terdaftar', value: totalUnits, subtitle: 'Ruang Layanan Aktif' },
                    { title: 'Poli & Rawat Inap', value: poliUnits, subtitle: 'Layanan Medis Langsung' },
                    { title: 'Instalasi Penunjang', value: instalasiUnits, subtitle: 'Penunjang Medis' },
                    { title: 'Manajemen & Loket', value: otherUnits > 0 ? otherUnits : 0, subtitle: 'Administrasi & Humas' },
                ],
                narrativeIntro: [
                    'I. RINGKASAN EKSEKUTIF INVENTARIS UNIT KERJA',
                    `Laporan resmi ini memuat rekapitulasi inventaris data seluruh unit kerja, poliklinik, instalasi kedaruratan, laboratorium, farmasi, serta ruang rawat inap yang telah terintegrasi dalam pangkalan data Sistem PUAS pada ${appSettings.kop_rs}.`,
                    `Setiap unit kerja telah dilengkapi dengan token identifikasi digital unik serta master QR Code meja/loket untuk memfasilitasi survei kepuasan masyarakat mandiri dan kanal pelaporan komplain pasien.`,
                    '',
                    'II. TABULASI MASTER DATA UNIT KERJA & RUANG LAYANAN:'
                ],
                tableHeaders: ['No', 'Nama Unit Kerja / Ruangan', 'Deskripsi / Lokasi Layanan', 'Tanggal Registrasi'],
                tableData: units.map((u, idx) => [
                    idx + 1,
                    u.nama,
                    u.deskripsi || '—',
                    new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                ])
            })
            setIsGenerating(false)
            showToast('success', 'Laporan PDF Master Unit berhasil diunduh.')
        }, 300)
    }

    const handleExportExcel = () => {
        setIsGenerating(true)
        setIsExportOpen(false)
        setTimeout(() => {
            const worksheetData = units.map((u, idx) => ({
                No: idx + 1,
                'Nama Unit Kerja / Ruangan': u.nama,
                'Deskripsi / Lokasi Layanan': u.deskripsi || '—',
                'Tanggal Registrasi': new Date(u.created_at).toLocaleDateString('id-ID')
            }))

            const worksheet = xlsx.utils.json_to_sheet([])

            xlsx.utils.sheet_add_aoa(worksheet, [
                [appSettings.kop_nama.toUpperCase()],
                [appSettings.kop_rs.toUpperCase()],
                [appSettings.kop_alamat],
                [appSettings.kop_kontak],
                [''],
                ['LAPORAN MASTER DATA UNIT KERJA DAN RUANG LAYANAN'],
                [`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
                [`Total Unit: ${units.length} Unit Kerja`],
                ['']
            ])

            xlsx.utils.sheet_add_json(worksheet, worksheetData, { origin: 'A10' })

            worksheet['!cols'] = [
                { wch: 6 },
                { wch: 40 },
                { wch: 55 },
                { wch: 22 }
            ]

            const workbook = xlsx.utils.book_new()
            xlsx.utils.book_append_sheet(workbook, worksheet, "Master_Unit_Kerja")
            xlsx.writeFile(workbook, `Laporan_Master_Unit_Kerja_${new Date().toISOString().slice(0, 10)}.xlsx`)
            setIsGenerating(false)
            showToast('success', 'Laporan Excel Master Unit berhasil diunduh.')
        }, 300)
    }

    // --- BACA FILE UPLOAD (POIN 6) ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = xlsx.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const data: any[] = xlsx.utils.sheet_to_json(ws)

                if (data.length === 0) {
                    showToast('error', 'File Excel kosong atau format tidak sesuai.')
                    return
                }

                const parsed = data.map((row) => {
                    const nama = row['Nama Unit Kerja'] || row['nama'] || row['Nama'] || row['Unit Kerja'] || ''
                    const deskripsi = row['Deskripsi / Tugas Pokok'] || row['deskripsi'] || row['Deskripsi'] || row['Keterangan'] || ''
                    return { nama: String(nama).trim(), deskripsi: String(deskripsi).trim() }
                }).filter(u => u.nama.length > 0)

                if (parsed.length === 0) {
                    showToast('error', 'Tidak ditemukan kolom "Nama Unit Kerja" yang valid.')
                    return
                }

                setImportedPreview(parsed)
                setIsImportModalOpen(true)
            } catch (err: any) {
                console.error(err)
                showToast('error', 'Gagal membaca file: ' + err.message)
            }
        }
        reader.readAsBinaryString(file)
    }

    // --- KONFIRMASI SIMPAN IMPORT BATCH KE SUPABASE (POIN 6) ---
    const handleConfirmImport = async () => {
        if (importedPreview.length === 0) return
        setIsImporting(true)

        try {
            const dataToInsert = importedPreview.map(item => ({
                nama: item.nama,
                deskripsi: item.deskripsi || null
            }))

            const { error } = await supabase.from('units').insert(dataToInsert)

            if (error) {
                showToast('error', 'Gagal mengimpor ke database: ' + error.message)
            } else {
                showToast('success', `Berhasil mengimpor ${importedPreview.length} unit kerja ke sistem!`)
                setIsImportModalOpen(false)
                setImportedPreview([])
                if (fileInputRef.current) fileInputRef.current.value = ''
                fetchUnits()
            }
        } catch (err: any) {
            showToast('error', 'Terjadi kesalahan sistem: ' + err.message)
        }
        setIsImporting(false)
    }

    const filteredUnits = units.filter(u => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (u.nama || '').toLowerCase().includes(q) || (u.deskripsi || '').toLowerCase().includes(q)
    })

    return (
        <div className="space-y-6 relative font-sans">
            {/* Toast */}
            <AnimatePresence>
                {saveMessage && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className={cn("fixed top-20 right-6 z-[100] px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-black border",
                            saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-red-50 text-red-800 border-red-300')}>
                        {saveMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                        {saveMessage.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden File Input for Excel Import */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
            />

            {/* Header & Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Building2 className="w-8 h-8 text-emerald-600" />
                        Master Unit Kerja
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1">
                        Kelola data satuan kerja, departemen, instalasi, dan loket pelayanan terpadu.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Tombol Unduh Laporan (PDF & Excel) */}
                    <div className="relative" ref={exportDropdownRef}>
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            disabled={isGenerating || units.length === 0}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-black transition-all shadow-2xs hover:shadow-xs disabled:opacity-50"
                            title="Unduh rekapitulasi data unit kerja resmi dalam format PDF atau Excel"
                        >
                            <Printer className="w-4 h-4 text-blue-600" />
                            <span>{isGenerating ? 'Memproses...' : 'Unduh Laporan'}</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-blue-600 transition-transform duration-200", isExportOpen ? "rotate-180" : "")} />
                        </button>

                        <AnimatePresence>
                            {isExportOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 overflow-hidden"
                                >
                                    <button
                                        onClick={handleExportPDF}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-xl hover:bg-slate-50 transition-colors text-xs font-extrabold text-slate-700 hover:text-red-600 group"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-bold">Format Dokumen PDF</div>
                                            <div className="text-[10px] text-slate-400 font-medium">Cover Resmi & Tabulasi Kop</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={handleExportExcel}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-xl hover:bg-slate-50 transition-colors text-xs font-extrabold text-slate-700 hover:text-emerald-700 group mt-1"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                                            <FileSpreadsheet className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-bold">Format Spreadsheet Excel</div>
                                            <div className="text-[10px] text-slate-400 font-medium">File .xlsx Siap Olah Data</div>
                                        </div>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Tombol Unduh Template Excel (Poin 6) */}
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black transition-all shadow-2xs hover:shadow-xs"
                        title="Unduh format template Excel untuk pengisian data unit kerja"
                    >
                        <Download className="w-4 h-4 text-slate-500" />
                        <span>Unduh Template</span>
                    </button>

                    {/* Tombol Import Data Excel (Poin 6) */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all shadow-2xs hover:shadow-xs"
                        title="Unggah file Excel untuk impor data unit kerja secara massal"
                    >
                        <Upload className="w-4 h-4 text-emerald-600" />
                        <span>Impor Data Excel</span>
                    </button>

                    {/* Tombol Tambah Manual */}
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus className="w-4 h-4" /> Tambah Unit
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan nama atau deskripsi unit kerja..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all"
                />
            </div>

            {/* Table Unit Kerja */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-100 uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="px-6 py-4 w-14">No</th>
                                <th className="px-6 py-4">Nama Unit Kerja / Pelayanan</th>
                                <th className="px-6 py-4">Deskripsi / Tugas Pokok</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            <p>Memuat daftar unit kerja...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUnits.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold">
                                        Belum ada unit kerja terdaftar. Gunakan tombol "Tambah Unit" atau "Impor Data Excel".
                                    </td>
                                </tr>
                            ) : (
                                filteredUnits.map((u, idx) => (
                                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-6 py-3.5 font-bold text-slate-400">{idx + 1}</td>
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span className="font-extrabold text-slate-900 text-xs">{u.nama}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-slate-600 font-medium">
                                            {u.deskripsi || '-'}
                                        </td>
                                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenModal(u)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold"
                                                    title="Edit Unit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(u.id, u.nama)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold"
                                                    title="Hapus Unit"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL INPUT MANUAL UNIT */}
            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50" onClick={() => setIsModalOpen(false)} />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden"
                            >
                                <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-5 h-5" />
                                        <h3 className="font-black text-sm">{formData.id ? 'Edit Unit Kerja' : 'Tambah Unit Kerja Baru'}</h3>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleSave} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                            Nama Unit Kerja *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.nama}
                                            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                            placeholder="Contoh: Instalasi Rawat Jalan (Poliklinik)"
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                            Deskripsi / Tugas Pokok
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formData.deskripsi}
                                            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                                            placeholder="Keterangan singkat tentang lingkup layanan..."
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                                        />
                                    </div>
                                    <div className="pt-2 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            <Save className="w-4 h-4" />
                                            <span>{isSaving ? 'Menyimpan...' : 'Simpan Data'}</span>
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* MODAL PRATINJAU IMPORT DATA EXCEL (POIN 6) */}
            <AnimatePresence>
                {isImportModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50" onClick={() => setIsImportModalOpen(false)} />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]"
                            >
                                <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="w-5 h-5" />
                                        <h3 className="font-black text-sm">Pratinjau Impor Data Unit Kerja ({importedPreview.length} Baris)</h3>
                                    </div>
                                    <button onClick={() => setIsImportModalOpen(false)} className="text-white/80 hover:text-white p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-4 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Data berhasil dibaca dari file Excel. Silakan periksa daftar di bawah sebelum menyimpan ke database.</span>
                                </div>

                                <div className="p-5 overflow-y-auto flex-1 space-y-2">
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px]">
                                                <tr>
                                                    <th className="px-3 py-2 w-10">No</th>
                                                    <th className="px-3 py-2">Nama Unit Kerja</th>
                                                    <th className="px-3 py-2">Deskripsi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {importedPreview.map((item, i) => (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className="px-3 py-2 text-slate-400 font-bold">{i + 1}</td>
                                                        <td className="px-3 py-2 font-extrabold text-slate-900">{item.nama}</td>
                                                        <td className="px-3 py-2 text-slate-600">{item.deskripsi || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setIsImportModalOpen(false)}
                                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isImporting}
                                        onClick={handleConfirmImport}
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>{isImporting ? 'Mengimpor ke Sistem...' : `Konfirmasi Simpan ${importedPreview.length} Unit`}</span>
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
