'use client'

import React, { useState, useEffect } from 'react'
import { ChevronLeft, Send, User, FileSearch, Truck, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import FormHeader from '@/components/FormHeader'
import BottomNav from '@/components/BottomNav'
import AppFooter from '@/components/AppFooter'
import TicketSuccess from '@/components/TicketSuccess'
import { cn } from '@/utils/cn'
import { createClient } from '@/utils/supabase/client'

const KATEGORI_PEMOHON = ['Perorangan (Pasien/Keluarga)', 'Lembaga/Organisasi/Media', 'Mahasiswa/Peneliti']
const TUJUAN_INFORMASI = ['Kepentingan Pengobatan/Medis', 'Keperluan Penelitian/Pendidikan', 'Keperluan Hukum/Administrasi', 'Informasi Publik Umum']
const CARA_MEMPEROLEH = ['Melihat/Membaca Langsung di RS', 'Mendapatkan Salinan (Hardcopy)', 'Mendapatkan Salinan Elektronik (Softcopy/PDF)']
const METODE_PENGIRIMAN = ['Diambil Langsung', 'Email (Direkomendasikan)', 'WhatsApp', 'Jasa Pengiriman/Kurir']

export default function InformasiPage() {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [ticketNumber, setTicketNumber] = useState<string | null>(null)
    const [persetujuan, setPersetujuan] = useState(false)
    const [unitOptions, setUnitOptions] = useState<{ id: string, nama: string }[]>([])
    const [isUnitLocked, setIsUnitLocked] = useState(false)
    const [lockedUnitName, setLockedUnitName] = useState('')

    useEffect(() => {
        const fetchUnits = async () => {
            const supabase = createClient()
            const { data } = await supabase.from('units').select('id, nama').order('nama')
            if (data) {
                setUnitOptions(data)

                if (typeof window !== 'undefined') {
                    const params = new URLSearchParams(window.location.search)
                    const uId = params.get('unitId')
                    const lock = params.get('lockUnit') === 'true'

                    if (uId) {
                        setForm(p => ({ ...p, unitDituju: uId }))
                        const found = data.find(u => u.id === uId)
                        if (found) {
                            setLockedUnitName(found.nama)
                        }
                        if (lock) {
                            setIsUnitLocked(true)
                        }
                    }
                }
            }
        }
        fetchUnits()
    }, [])

    const [form, setForm] = useState({
        nama: '', noIdentitas: '', kategoriPemohon: '', alamat: '', noWA: '', email: '',
        topikInformasi: '', unitDituju: '', tujuan: '', uraianDetail: '',
        caraMemperoleh: '', metodePengiriman: '',
    })

    const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }))

    const canProceed1 = form.nama && form.kategoriPemohon && form.noWA
    const canProceed2 = form.topikInformasi && form.unitDituju && form.tujuan && form.uraianDetail.length >= 10
    const canProceed3 = form.caraMemperoleh && form.metodePengiriman && persetujuan

    const handleSubmit = async () => {
        setIsSubmitting(true)
        const supabase = createClient()
        const trackNo = `INF-${Math.floor(10000 + Math.random() * 90000)}`
        const unitIdValue = form.unitDituju ? form.unitDituju : null;
        const targetUnit = unitOptions.find(u => u.id === form.unitDituju);
        const storedUnitValue = targetUnit ? targetUnit.nama : form.unitDituju;

        const payloadToSave = { ...form, unitDituju: storedUnitValue };

        const { error } = await supabase.from('tickets').insert({
            tracking_number: trackNo,
            jenis: 'informasi',
            status: 'Terkirim',
            unit_id: unitIdValue,
            data_payload: payloadToSave
        })
        setTimeout(() => {
            setIsSubmitting(false)
            if (!error) setTicketNumber(trackNo)
            else alert('Gagal mengirim: ' + error.message)
        }, 1000)
    }

    if (ticketNumber) {
        return <TicketSuccess trackingNumber={ticketNumber} title="Permohonan Terkirim!" message="Permintaan informasi Anda telah diterima. Petugas kami akan merespon sesuai SLA 1x24 jam kerja." jenis="PERMINTAAN INFORMASI" />
    }

    const StepLabel = ({ n, label, active }: { n: number; label: string; active: boolean }) => (
        <div className={cn("flex items-center gap-1.5 transition-all", active ? "opacity-100" : "opacity-40")}>
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2", active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-400 border-slate-200")}>{n}</div>
            <span className="text-[9px] font-bold text-slate-600 hidden sm:inline">{label}</span>
        </div>
    )

    return (
        <main className="min-h-screen pb-24 bg-slate-50 font-sans">
            <Link href="/" className="absolute top-6 left-6 z-20 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-700 border border-white/60 shadow-sm cursor-pointer hover:bg-white transition-colors"><ChevronLeft className="w-6 h-6" /></Link>
            <FormHeader title="Permintaan Informasi" subtitle="Formulir Permintaan Informasi (FPI-RS)" iconUrl="https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Light%20bulb/3D/light_bulb_3d.png" />

            <div className="px-6 -mt-8 relative z-20">
                <div className="flex items-center justify-between mb-6 px-1">
                    {[{ n: 1, l: 'Identitas' }, { n: 2, l: 'Rincian' }, { n: 3, l: 'Metode & Kirim' }].map((s, i) => (
                        <React.Fragment key={s.n}><StepLabel n={s.n} label={s.l} active={step >= s.n} />{i < 2 && <div className={cn("flex-1 h-0.5 mx-1", step > s.n ? "bg-blue-600" : "bg-slate-200")} />}</React.Fragment>
                    ))}
                </div>

                <div className="bg-white w-full rounded-[2rem] p-6 shadow-md shadow-slate-200/50 border border-slate-100">

                    {/* STEP 1: Identitas Pemohon */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><User className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">I. Identitas Pemohon (Siapa)</h3><p className="text-[10px] text-slate-500 font-semibold">Untuk validasi dan pengiriman informasi</p></div>
                            </div>
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold text-slate-600 mb-1 block">Nama Lengkap <span className="text-red-500">*</span></label><input value={form.nama} onChange={e => set('nama', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Nama pemohon" /></div>
                                <div><label className="text-xs font-bold text-slate-600 mb-1 block">No. Identitas (KTP/SIM/Paspor)</label><input value={form.noIdentitas} onChange={e => set('noIdentitas', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Opsional" /></div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 mb-2 block">Kategori Pemohon <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {KATEGORI_PEMOHON.map(opt => (
                                            <label key={opt} className={cn("flex items-center p-3 border rounded-xl cursor-pointer transition-all text-sm font-medium text-slate-800", form.kategoriPemohon === opt ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/20" : "border-slate-200 hover:bg-slate-50")}>
                                                <input type="radio" className="hidden" checked={form.kategoriPemohon === opt} onChange={() => set('kategoriPemohon', opt)} /><span>{opt}</span>{form.kategoriPemohon === opt && <span className="ml-auto text-blue-500 font-bold">✓</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div><label className="text-xs font-bold text-slate-600 mb-1 block">Alamat Korespondensi</label><input value={form.alamat} onChange={e => set('alamat', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Alamat lengkap" /></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">No. WhatsApp / Telepon <span className="text-red-500">*</span></label><input value={form.noWA} onChange={e => set('noWA', e.target.value)} type="tel" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="08xxxxxxxxxx" /></div>
                                    <div><label className="text-xs font-bold text-slate-600 mb-1 block">Email</label><input value={form.email} onChange={e => set('email', e.target.value)} type="email" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="user@mail.com" /></div>
                                </div>
                            </div>
                            <button type="button" onClick={() => setStep(2)} disabled={!canProceed1} className="mt-6 w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-slate-800">Lanjutkan &rarr;</button>
                        </div>
                    )}

                    {/* STEP 2: Rincian Informasi */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><FileSearch className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">II. Rincian Informasi (Apa)</h3><p className="text-[10px] text-slate-500 font-semibold">Klasifikasi kebutuhan informasi</p></div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1 block">Judul/Topik Informasi <span className="text-red-500">*</span></label>
                                <input value={form.topikInformasi} onChange={e => set('topikInformasi', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Contoh: Tarif Layanan, Jadwal Dokter, Data Statistik" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-600 block">Unit Dituju <span className="text-red-500">*</span></label>
                                    {isUnitLocked && (
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                                            🔒 Terkunci via QR Code
                                        </span>
                                    )}
                                </div>
                                {isUnitLocked ? (
                                    <div className="w-full bg-blue-50/70 border border-blue-300 rounded-xl px-4 py-3.5 text-sm font-black text-blue-950 flex items-center justify-between shadow-2xs">
                                        <span>{lockedUnitName || 'Unit Terpilih'}</span>
                                        <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                                            Otomatis
                                        </span>
                                    </div>
                                ) : (
                                    <select value={form.unitDituju} onChange={e => set('unitDituju', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold !text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                                        <option value="" disabled>Pilih Unit Kerja...</option>
                                        {unitOptions.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-2 block">Tujuan Penggunaan <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {TUJUAN_INFORMASI.map(opt => (
                                        <label key={opt} className={cn("flex items-center p-3 border rounded-xl cursor-pointer transition-all text-sm font-medium text-slate-800", form.tujuan === opt ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/20" : "border-slate-200 hover:bg-slate-50")}>
                                            <input type="radio" className="hidden" checked={form.tujuan === opt} onChange={() => set('tujuan', opt)} /><span>{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-2 block">Uraian Detail Informasi <span className="text-red-500">*</span></label>
                                <textarea value={form.uraianDetail} onChange={e => set('uraianDetail', e.target.value)} rows={5} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none" placeholder="Berikan deskripsi spesifik agar tim kami dapat menyediakan data yang tepat..." />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setStep(1)} className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
                                <button type="button" onClick={() => setStep(3)} disabled={!canProceed2} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-slate-800">Lanjutkan &rarr;</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Metode & Submit */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center"><Truck className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">III. Metode Penyampaian (Bagaimana)</h3><p className="text-[10px] text-slate-500 font-semibold">Kanal distribusi informasi</p></div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-2 block">Cara Memperoleh Informasi <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 gap-2">
                                    {CARA_MEMPEROLEH.map(opt => (
                                        <label key={opt} className={cn("flex items-center p-3 border rounded-xl cursor-pointer transition-all text-sm font-medium text-slate-800", form.caraMemperoleh === opt ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/20" : "border-slate-200 hover:bg-slate-50")}>
                                            <input type="radio" className="hidden" checked={form.caraMemperoleh === opt} onChange={() => set('caraMemperoleh', opt)} /><span>{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-2 block">Metode Pengiriman <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-2 gap-2">
                                    {METODE_PENGIRIMAN.map(opt => (
                                        <label key={opt} className={cn("flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all text-sm font-bold text-center", form.metodePengiriman === opt ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/20 text-blue-700" : "border-slate-200 hover:bg-slate-50 text-slate-600")}>
                                            <input type="radio" className="hidden" checked={form.metodePengiriman === opt} onChange={() => set('metodePengiriman', opt)} />{opt}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Pernyataan */}
                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mt-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
                                    <p className="text-xs font-bold text-slate-700">IV. Pernyataan & Persetujuan</p>
                                </div>
                                <p className="text-xs text-slate-500 mb-3 leading-relaxed">Saya menyatakan bahwa informasi yang saya minta akan digunakan sesuai dengan tujuan yang telah saya lampirkan dan bersedia mematuhi peraturan rumah sakit serta undang-undang yang berlaku terkait penggunaan data.</p>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={persetujuan} onChange={e => setPersetujuan(e.target.checked)} className="accent-blue-600 w-4 h-4" />
                                    <span className="text-sm font-bold text-slate-700">Saya menyetujui pernyataan di atas</span>
                                </label>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setStep(2)} className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
                                <button type="button" onClick={handleSubmit} disabled={isSubmitting || !canProceed3} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-80 transition-all drop-shadow-md cursor-pointer">
                                    {isSubmitting ? 'Mengamankan Data...' : 'Kirim Permohonan'}
                                    {!isSubmitting && <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <AppFooter />
            <BottomNav />
        </main>
    )
}
