'use client'

import React, { useState, useEffect } from 'react'
import { Save, Bell, Clock, Building, ShieldCheck, Mail, Sliders, CheckCircle2, AlertCircle, FileText, User, Phone, MapPin, Globe, MessageCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'
import { generateSystemOverviewPDF } from '@/utils/pdfExport'

const DEFAULT_SETTINGS = {
    nama_instansi: 'Pemerintah Kota Sejahtera',
    nama_sub_instansi: 'Rumah Sakit Umum Daerah Kota Sejahtera',
    alamat_instansi: 'Jl. Jend. Sudirman No. 123',
    kontak_instansi: 'Telp: (021) 555-0192 | Email: rsud@sejahtera.go.id',
    website_instansi: 'rsud.sejahtera.go.id',
    whatsapp_kontak: '',
    nama_penandatangan: 'Dr. Mulyadi Saputra, MARS',
    jabatan_penandatangan: 'Direktur Utama RSUD Kota Sejahtera',
    nip_penandatangan: '',
    // SLA
    sla_normal_limit: '24',
    sla_normal_warning: '18',
    sla_high_limit: '4',
    sla_high_warning: '2',
    // Print & Footer
    print_header: 'PEMERINTAH KOTA SEJAHTERA\nDINAS KESEHATAN\nRUMAH SAKIT UMUM DAERAH KOTA SEJAHTERA',
    print_footer: 'Dokumen ini digenerate secara otomatis oleh Sistem PUAS.\nDicetak secara sah. Segala pemalsuan akan diproses secara hukum.',
    app_footer_text: 'PINTAR PUAS @2026. Mukhsin Hadi. All Right Reserved.',
    app_name: 'PUAS',
    app_logo: '',
}

const InputField = ({ value, onChange, label, icon: Icon, placeholder, type = 'text', hint }: { value: string, onChange: (val: string) => void, label: string, icon?: any, placeholder?: string, type?: string, hint?: string }) => (
    <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2.5 flex items-center gap-2">
            {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
            {label}
        </label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || label}
            className="w-full px-4 py-3 bg-slate-50/80 text-slate-900 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-slate-300"
        />
        {hint && <p className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{hint}</p>}
    </div>
)

const TextAreaField = ({ value, onChange, label, placeholder, rows = 4, hint, positionHint }: { value: string, onChange: (val: string) => void, label: string, placeholder?: string, rows?: number, hint?: string, positionHint?: string }) => (
    <div>
        <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
            {label}
            {positionHint && <span className="text-[10px] font-semibold px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg">{positionHint}</span>}
        </label>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all font-semibold text-slate-800 shadow-inner leading-relaxed placeholder:text-slate-300"
            placeholder={placeholder}
            rows={rows}
        />
        {hint && <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{hint}</p>}
    </div>
)

export default function AdminSettingsPage() {
    const [activeMenu, setActiveMenu] = useState('Identitas')
    const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [isLoaded, setIsLoaded] = useState(false)

    const router = useRouter()

    useEffect(() => {
        const fetchSettingsAndCheckAuth = async () => {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
                if (profile?.role === 'user') {
                    return router.push('/admin/tiket')
                }
            }

            const { data } = await supabase.from('app_settings').select('*')
            if (data) {
                // Merge database values over defaults
                const merged = { ...DEFAULT_SETTINGS }
                data.forEach(item => {
                    const key = item.setting_key as keyof typeof DEFAULT_SETTINGS
                    if (merged[key] !== undefined && item.setting_value !== undefined && item.setting_value !== null) {
                        merged[key] = String(item.setting_value)
                    }
                })
                setSettings(merged)
            }
            setIsLoaded(true)
        }
        fetchSettingsAndCheckAuth()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            alert('Ukuran file maksimal 5MB')
            return
        }
        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const maxDim = 250
                let width = img.width
                let height = img.height
                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width)
                        width = maxDim
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height)
                        height = maxDim
                    }
                }
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height)
                    const compressedDataUrl = canvas.toDataURL('image/png')
                    handleChange('app_logo', compressedDataUrl)
                }
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    const handleSave = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault()
        setIsSaving(true)
        setSaveStatus('idle')
        const supabase = createClient()

        try {
            // Upsert each setting key-value pair cleanly
            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined && value !== null) {
                    const { data: existing } = await supabase
                        .from('app_settings')
                        .select('id')
                        .eq('setting_key', key)
                        .maybeSingle()

                    if (existing) {
                        await supabase
                            .from('app_settings')
                            .update({ setting_value: String(value), updated_at: new Date().toISOString() })
                            .eq('id', existing.id)
                    } else {
                        await supabase
                            .from('app_settings')
                            .insert({ setting_key: key, setting_value: String(value) })
                    }
                }
            }
            setSaveStatus('success')
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('app_settings_updated'))
            }
        } catch (error) {
            console.error("Error saving settings:", error)
            setSaveStatus('error')
        } finally {
            setIsSaving(false)
            setTimeout(() => setSaveStatus('idle'), 4000)
        }
    }

    const handleDownloadSystemReport = () => {
        generateSystemOverviewPDF({
            appSettings: settings,
            printDate: new Date().toISOString()
        })
    }

    const MENUS = [
        { id: 'Identitas', icon: Building, desc: 'Profil Institusi', color: 'text-indigo-500 bg-indigo-50' },
        { id: 'SLA & Eskalasi', icon: Clock, desc: 'Batas waktu & peringatan', color: 'text-amber-500 bg-amber-50' },
        { id: 'Format Laporan', icon: FileText, desc: 'Kop surat & tanda tangan', color: 'text-emerald-500 bg-emerald-50' },
        { id: 'Dokumentasi', icon: ShieldCheck, desc: 'Unduh panduan & gambaran', color: 'text-blue-500 bg-blue-50' },
    ]

    if (!isLoaded) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-slate-500 font-medium text-sm">Memuat konfigurasi sistem...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-extrabold text-slate-800 tracking-tight"
                    >
                        Pengaturan Sistem
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-500 mt-2 font-medium"
                    >
                        Konfigurasi identitas institusi, batas SLA, dan format cetak dokumen.
                    </motion.p>
                </div>

                <AnimatePresence>
                    {saveStatus === 'success' && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-emerald-50 text-emerald-700 px-4 py-2 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm"
                        >
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            Semua pengaturan berhasil disimpan!
                        </motion.div>
                    )}
                    {saveStatus === 'error' && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-red-50 text-red-700 px-4 py-2 border border-red-200 rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm"
                        >
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            Gagal menyimpan. Periksa koneksi database.
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Navigation Sidebar */}
                <div className="w-full lg:w-72 shrink-0 space-y-2">
                    {MENUS.map((menu, idx) => (
                        <motion.button
                            type="button"
                            key={menu.id}
                            onClick={() => setActiveMenu(menu.id)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={cn(
                                "w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all text-left border",
                                activeMenu === menu.id
                                    ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20"
                                    : "bg-white border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200"
                            )}
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                activeMenu === menu.id ? "bg-white/10 text-emerald-400" : menu.color
                            )}>
                                <menu.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-sm">{menu.id}</div>
                                <div className={cn("text-xs font-medium mt-0.5", activeMenu === menu.id ? "text-slate-300" : "text-slate-400")}>
                                    {menu.desc}
                                </div>
                            </div>
                        </motion.button>
                    ))}

                    {/* Save button in sidebar */}
                    <div className="pt-4">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" /> Simpan Semua Pengaturan
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    <AnimatePresence mode="wait">
                        {/* ===== IDENTITAS INSTITUSI ===== */}
                        {activeMenu === 'Identitas' && (
                            <motion.div
                                key="identitas"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-8"
                            >
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">Profil Institusi</h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Informasi identitas yang digunakan pada kop surat, laporan, dan seluruh elemen sistem.</p>
                                </div>

                                {/* Main identity */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <InputField value={settings.app_name || ''} onChange={(val) => handleChange('app_name', val)} label="Nama Aplikasi" icon={Globe} placeholder="PUAS" hint="Akan tampil di header dan judul halaman" />
                                    <InputField value={settings.nama_instansi || ''} onChange={(val) => handleChange('nama_instansi', val)} label="Nama Instansi Induk" icon={Building} placeholder="Pemerintah Kota Sejahtera" />
                                    <div className="sm:col-span-2">
                                        <InputField value={settings.nama_sub_instansi || ''} onChange={(val) => handleChange('nama_sub_instansi', val)} label="Nama Sub Instansi / Satuan Kerja" icon={Building} placeholder="Rumah Sakit Umum Daerah Kota Sejahtera" />
                                    </div>
                                </div>

                                {/* Address & Contact */}
                                <div className="pt-6 border-t border-slate-100 space-y-6">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                        <MapPin className="w-4 h-4 text-primary" /> Alamat & Kontak
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="sm:col-span-2">
                                            <InputField value={settings.alamat_instansi || ''} onChange={(val) => handleChange('alamat_instansi', val)} label="Alamat Lengkap" icon={MapPin} placeholder="Jl. Jend. Sudirman No. 123" />
                                        </div>
                                        <InputField value={settings.kontak_instansi || ''} onChange={(val) => handleChange('kontak_instansi', val)} label="Kontak (Telp/Email)" icon={Phone} placeholder="Telp: (021) 555-0192" />
                                        <InputField value={settings.website_instansi || ''} onChange={(val) => handleChange('website_instansi', val)} label="Website" icon={Globe} placeholder="rsud.sejahtera.go.id" />
                                    </div>
                                </div>

                                {/* WhatsApp Contact */}
                                <div className="pt-6 border-t border-slate-100 space-y-6">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                        <MessageCircle className="w-4 h-4 text-emerald-500" /> Kontak WhatsApp
                                    </h3>
                                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100/60 p-5 rounded-2xl flex gap-4 text-emerald-900 text-sm items-start shadow-sm">
                                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 shrink-0">
                                            <MessageCircle className="w-5 h-5" />
                                        </div>
                                        <p className="font-medium leading-relaxed">Nomor WhatsApp ini akan digunakan untuk fitur <strong>&quot;Hubungi WA&quot;</strong> pada halaman pelacakan tiket dan halaman publik lainnya. Pastikan menggunakan format internasional (misal: <strong>6281234567890</strong>).</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <InputField
                                            value={settings.whatsapp_kontak || ''}
                                            onChange={(val) => handleChange('whatsapp_kontak', val)}
                                            label="Nomor WhatsApp"
                                            icon={MessageCircle}
                                            placeholder="6281234567890"
                                            hint="Format internasional tanpa tanda + (contoh: 6281234567890)"
                                        />
                                        <div className="flex items-end">
                                            {settings.whatsapp_kontak && (
                                                <a
                                                    href={`https://wa.me/${settings.whatsapp_kontak.replace(/\D/g, '')}?text=${encodeURIComponent('Test koneksi WhatsApp dari sistem PUAS')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    Test WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Logo */}
                                <div className="pt-6 border-t border-slate-100">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                                        <Building className="w-4 h-4 text-primary" /> Logo Instansi / Aplikasi
                                    </h3>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                        <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center font-bold text-slate-400 text-3xl overflow-hidden shadow-inner relative group">
                                            {settings.app_logo ? (
                                                <img src={settings.app_logo} alt="Logo Instansi" className="w-full h-full object-cover" />
                                            ) : settings.nama_sub_instansi ? (
                                                settings.nama_sub_instansi.charAt(0).toUpperCase()
                                            ) : (
                                                'R'
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors border border-slate-200">
                                                <span>Pilih File Logo Baru</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                    className="hidden"
                                                />
                                            </label>
                                            {settings.app_logo && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('app_logo', '')}
                                                    className="block text-xs font-bold text-red-500 hover:underline"
                                                >
                                                    Hapus Logo Saat Ini
                                                </button>
                                            )}
                                            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 shrink-0" /> Maksimal 2MB. Format PNG, SVG, atau JPG.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ===== SLA & ESKALASI ===== */}
                        {activeMenu === 'SLA & Eskalasi' && (
                            <motion.div
                                key="sla"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-8"
                            >
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">Manajemen SLA (Service Level Agreement)</h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Tentukan batasan waktu penyelesaian tiket berdasarkan tingkat prioritas.</p>
                                </div>

                                {/* Info Banner */}
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100/60 p-5 rounded-2xl flex gap-4 text-amber-900 text-sm items-start shadow-sm">
                                    <div className="bg-amber-100 p-2 rounded-xl text-amber-600 shrink-0">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <p className="font-medium leading-relaxed">Notifikasi eskalasi akan otomatis terpicu saat umur tiket mencapai atau melewati ambang waktu <strong>Peringatan</strong> yang ditentukan di bawah. Eskalasi akan dikirim ke admin terkait.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Normal Priority */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 border border-slate-100 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
                                            <h4 className="font-bold text-slate-800 text-sm">Prioritas Normal</h4>
                                        </div>
                                        <InputField value={settings.sla_normal_limit || ''} onChange={(val) => handleChange('sla_normal_limit', val)} label="Batas Waktu Maksimal (Jam)" type="number" placeholder="24" hint="Tiket akan ditandai terlambat setelah melewati batas ini" />
                                        <InputField value={settings.sla_normal_warning || ''} onChange={(val) => handleChange('sla_normal_warning', val)} label="Mulai Peringatan Sejak (Jam)" type="number" placeholder="18" hint="Notifikasi akan dikirim saat mencapai waktu ini" />
                                    </div>

                                    {/* High Priority */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 border border-slate-100 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/40" />
                                            <h4 className="font-bold text-slate-800 text-sm">Prioritas Tinggi & Urgent</h4>
                                        </div>
                                        <InputField value={settings.sla_high_limit || ''} onChange={(val) => handleChange('sla_high_limit', val)} label="Batas Waktu Maksimal (Jam)" type="number" placeholder="4" hint="Standar: 2-4 jam untuk tiket kritis" />
                                        <InputField value={settings.sla_high_warning || ''} onChange={(val) => handleChange('sla_high_warning', val)} label="Mulai Peringatan Sejak (Jam)" type="number" placeholder="2" hint="Peringatan dini sebelum batas waktu tercapai" />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ===== FORMAT LAPORAN ===== */}
                        {activeMenu === 'Format Laporan' && (
                            <motion.div
                                key="laporan"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-8"
                            >
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">Pengaturan Format Cetak Laporan</h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Konfigurasi teks kop surat, catatan kaki, dan penandatangan yang tersemat otomatis pada hasil ekspor PDF/Excel.</p>
                                </div>

                                {/* Kop Surat */}
                                <TextAreaField
                                    value={settings.print_header || ''}
                                    onChange={(val) => handleChange('print_header', val)}
                                    label="Teks Kop Surat (Header)"
                                    placeholder={"Baris 1 (Nama Pemerintah)\nBaris 2 (Nama Dinas)\nBaris 3 (Nama RSUD/Instansi)"}
                                    rows={4}
                                    positionHint="Posisi: Tengah Atas"
                                    hint="Setiap baris baru akan menjadi baris terpisah pada kop surat."
                                />

                                {/* Penandatangan */}
                                <div className="pt-6 border-t border-slate-100 space-y-6">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                        <User className="w-4 h-4 text-primary" /> Penandatangan Default
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <InputField value={settings.nama_penandatangan || ''} onChange={(val) => handleChange('nama_penandatangan', val)} label="Nama Penandatangan" icon={User} placeholder="Dr. Mulyadi Saputra, MARS" />
                                        <InputField value={settings.jabatan_penandatangan || ''} onChange={(val) => handleChange('jabatan_penandatangan', val)} label="Jabatan Penandatangan" icon={ShieldCheck} placeholder="Direktur Utama" />
                                        <div className="sm:col-span-2">
                                            <InputField value={settings.nip_penandatangan || ''} onChange={(val) => handleChange('nip_penandatangan', val)} label="NIP (Opsional)" placeholder="19760512 200112 1 005" hint="Akan ditampilkan di bawah nama penandatangan jika diisi" />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100 space-y-6">
                                    <TextAreaField
                                        value={settings.print_footer || ''}
                                        onChange={(val) => handleChange('print_footer', val)}
                                        label="Catatan Kaki Laporan (Footer Dokumen Cetak/PDF)"
                                        placeholder="Dokumen ini digenerate secara otomatis oleh Sistem..."
                                        rows={3}
                                        positionHint="Posisi: Bawah Dokumen PDF/Cetak"
                                        hint="Teks ini akan muncul di bagian bawah setiap halaman laporan PDF yang dicetak."
                                    />

                                    <InputField
                                        value={settings.app_footer_text || ''}
                                        onChange={(val) => handleChange('app_footer_text', val)}
                                        label="Teks Footer Halaman Aplikasi (Website Footer)"
                                        placeholder="PINTAR PUAS @2026. Mukhsin Hadi. All Right Reserved."
                                        hint="Teks ini akan muncul di bagian footer bawah seluruh halaman web aplikasi."
                                    />
                                </div>

                                {/* Preview */}
                                <div className="pt-6 border-t border-slate-100">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
                                        <FileText className="w-4 h-4 text-primary" /> Pratinjau Kop Surat
                                    </h3>
                                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-1">
                                        {(settings.print_header || '').split('\n').map((line, i) => (
                                            <p key={i} className={cn(
                                                "text-slate-800 font-bold",
                                                i === 0 ? "text-sm" : i === 1 ? "text-base" : "text-lg"
                                            )}>
                                                {line || '—'}
                                            </p>
                                        ))}
                                        <div className="border-b-2 border-slate-800 pt-2 mx-auto w-4/5" />
                                        <div className="border-b border-slate-800 pt-0.5 mx-auto w-4/5" />
                                        <p className="text-[10px] text-slate-400 pt-4 font-medium">{settings.alamat_instansi || 'Alamat belum diatur'}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ===== DOKUMENTASI & LAPORAN SISTEM ===== */}
                        {activeMenu === 'Dokumentasi' && (
                            <motion.div
                                key="dokumentasi"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-8"
                            >
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">Dokumentasi & Laporan Sistem</h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Unduh dokumen resmi gambaran umum aplikasi, petunjuk penggunaan (manual book), dan struktur menu secara profesional.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">Laporan Gambaran Umum</h3>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Format: PDF Professional</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
                                                Dokumen ini berisi profil institusi, visi misi sistem, fitur utama, struktur menu admin & publik, serta panduan singkat penggunaan aplikasi untuk pelapor dan petugas.
                                            </p>
                                            <button
                                                onClick={handleDownloadSystemReport}
                                                className="w-full py-3 bg-white border-2 border-blue-600 text-blue-600 font-bold rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                            >
                                                <FileText className="w-4 h-4" /> Unduh Laporan Sistem
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative overflow-hidden group rounded-2xl border border-slate-100 p-8 flex flex-col items-center justify-center text-center space-y-4 bg-gradient-to-br from-indigo-50/50 to-white">
                                        <div className="w-16 h-16 bg-white shadow-xl shadow-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500 mb-2">
                                            <ShieldCheck className="w-8 h-8" />
                                        </div>
                                        <h4 className="font-black text-slate-800 uppercase tracking-tighter">Sistematika Profesional</h4>
                                        <p className="text-xs text-slate-500 font-medium">Laporan akan dibuat secara dinamis menyesuaikan pengaturan identitas instansi yang telah Anda simpan di sistem.</p>
                                        <div className="flex gap-1.5">
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-bold rounded-full">COVER</span>
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-bold rounded-full">MANUAL</span>
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-bold rounded-full">FITUR</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100">
                                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 items-start">
                                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="text-xs text-amber-800 font-medium leading-relaxed">
                                            <strong>Tips:</strong> Untuk hasil terbaik, pastikan Anda telah mengisi <strong>Identitas Institusi</strong> dan <strong>Kop Surat</strong> dengan benar sebelum mengunduh laporan ini agar data yang tertera akurat.
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
