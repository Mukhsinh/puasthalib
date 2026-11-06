'use client'

import React, { useState, useEffect } from 'react'
import { ChevronLeft, Send, User, MapPin, ListChecks, MessageCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import FormHeader from '@/components/FormHeader'
import BottomNav from '@/components/BottomNav'
import AppFooter from '@/components/AppFooter'
import TicketSuccess from '@/components/TicketSuccess'
import { cn } from '@/utils/cn'
import { createClient } from '@/utils/supabase/client'

const HUBUNGAN_OPTIONS = ['Pasien Sendiri', 'Keluarga Pasien (Suami/Istri/Anak/Orang Tua)', 'Pengunjung']
const KATEGORI_KOMPLAIN = [
    { value: 'komunikasi', label: 'Komunikasi & Perilaku', desc: 'Sikap petugas tidak ramah, kurang penjelasan dokter, dll' },
    { value: 'kualitas_medis', label: 'Kualitas Layanan Medis', desc: 'Prosedur tindakan, penanganan nyeri, ketidaksesuaian diagnosis' },
    { value: 'waktu_tunggu', label: 'Waktu Tunggu', desc: 'Antrean obat lama, dokter terlambat, respon perawat lambat' },
    { value: 'fasilitas', label: 'Fasilitas & Kebersihan', desc: 'AC mati, toilet kotor, sprei tidak diganti, parkir semrawut' },
    { value: 'biaya', label: 'Biaya & Administrasi', desc: 'Kesalahan tagihan, prosedur asuransi/BPJS rumit' },
    { value: 'keamanan', label: 'Keamanan', desc: 'Kehilangan barang, gangguan ketertiban' },
]
const HARAPAN_OPTIONS = ['Permohonan maaf secara langsung', 'Perbaikan fasilitas/sistem segera', 'Penjelasan teknis dari pihak medis terkait', 'Kompensasi / Pengembalian biaya (jika relevan)', 'Lainnya']

export default function KomplainPage() {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [ticketNumber, setTicketNumber] = useState<string | null>(null)
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
                        setForm(p => ({ ...p, unitLokasi: uId }))
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

    // Form state (manual for simplicity with multi-step)
    const [form, setForm] = useState({
        nama: '', noRM: '', noHP: '', hubungan: '',
        tglKejadian: '', jamKejadian: '', unitLokasi: '', unitLokasiLain: '',
        kategori: [] as string[], detailKejadian: '',
        harapan: [] as string[], harapanLain: '',
    })

    const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }))
    const toggleArr = (key: 'kategori' | 'harapan', val: string) => {
        setForm(p => {
            const arr = p[key]
            return { ...p, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }
        })
    }

    const canProceed1 = form.nama && form.noHP && form.hubungan
    const canProceed2 = form.tglKejadian && form.unitLokasi
    const canProceed3 = form.kategori.length > 0
    const canProceed4 = form.detailKejadian.length >= 20

    const handleSubmit = async () => {
        setIsSubmitting(true)
        const supabase = createClient()
        const trackNo = `CMP-${Math.floor(10000 + Math.random() * 90000)}`

        const unitIdValue = form.unitLokasi && form.unitLokasi !== 'Lainnya' ? form.unitLokasi : null;
        const targetUnit = unitOptions.find(u => u.id === form.unitLokasi);
        const storedUnitValue = targetUnit ? targetUnit.nama : form.unitLokasi;
        const payloadToSave = { ...form, unitLokasi: storedUnitValue };

        const { error } = await supabase.from('tickets').insert({
            tracking_number: trackNo,
            jenis: 'komplain_pasien',
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
        return <TicketSuccess trackingNumber={ticketNumber} title="Komplain Diterima!" message="Keluhan Anda telah kami rekam dan akan segera ditindaklanjuti oleh tim terkait." jenis="KOMPLAIN" />
    }

    // Step indicator
    const StepLabel = ({ n, label, active }: { n: number; label: string; active: boolean }) => (
        <div className={cn("flex items-center gap-2 transition-all", active ? "opacity-100" : "opacity-40")}>
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all", active ? "bg-primary text-white border-primary" : "bg-white text-slate-400 border-slate-200")}>{n}</div>
            <span className="text-[10px] font-bold text-slate-600 hidden sm:inline">{label}</span>
        </div>
    )

    return (
        <main className="min-h-screen pb-24 bg-slate-50 font-sans">
            <Link href="/" className="absolute top-6 left-6 z-20 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-700 border border-white/60 shadow-sm cursor-pointer hover:bg-white transition-colors">
                <ChevronLeft className="w-6 h-6" />
            </Link>
            <FormHeader title="Komplain Pasien" subtitle="Formulir Pengaduan & Keluhan Pelanggan (Customer Complaint)" iconUrl="https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Warning/3D/warning_3d.png" />

            <div className="px-6 -mt-8 relative z-20">
                {/* Progress stepper */}
                <div className="flex items-center justify-between mb-6 px-2">
                    {[{ n: 1, l: 'Data Pelapor' }, { n: 2, l: 'Lokasi & Waktu' }, { n: 3, l: 'Kategori' }, { n: 4, l: 'Uraian' }, { n: 5, l: 'Harapan' }].map((s, i) => (
                        <React.Fragment key={s.n}>
                            <StepLabel n={s.n} label={s.l} active={step >= s.n} />
                            {i < 4 && <div className={cn("flex-1 h-0.5 mx-1 transition-all", step > s.n ? "bg-primary" : "bg-slate-200")} />}
                        </React.Fragment>
                    ))}
                </div>

                <div className="bg-white w-full rounded-[2rem] p-6 shadow-md shadow-slate-200/50 border border-slate-100">

                    {/* STEP 1: Data Pelapor */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><User className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">I. Data Pelapor (Siapa)</h3><p className="text-[10px] text-slate-500 font-semibold">Penting untuk verifikasi dan tindak lanjut</p></div>
                            </div>
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold text-slate-600 mb-1 block">Nama Lengkap <span className="text-red-500">*</span></label><input value={form.nama} onChange={e => set('nama', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Nama pelapor" /></div>
                                <div><label className="text-xs font-bold text-slate-600 mb-1 block">No. Rekam Medis <span className="text-slate-400">(Jika Pasien)</span></label><input value={form.noRM} onChange={e => set('noRM', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Opsional" /></div>
                                <div><label className="text-xs font-bold text-slate-600 mb-1 block">No. HP / WhatsApp <span className="text-red-500">*</span></label><input value={form.noHP} onChange={e => set('noHP', e.target.value)} type="tel" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="08xxxxxxxxxx" /></div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 mb-2 block">Hubungan Pelapor <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {HUBUNGAN_OPTIONS.map(opt => (
                                            <label key={opt} className={cn("flex items-center p-3 border rounded-xl cursor-pointer transition-all text-sm font-medium text-slate-800", form.hubungan === opt ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-200 hover:bg-slate-50")}>
                                                <input type="radio" className="hidden" checked={form.hubungan === opt} onChange={() => set('hubungan', opt)} /><span>{opt}</span>{form.hubungan === opt && <span className="ml-auto text-primary font-bold">✓</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button type="button" onClick={() => setStep(2)} disabled={!canProceed1} className="mt-6 w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-slate-800">Lanjutkan &rarr;</button>
                        </div>
                    )}

                    {/* STEP 2: Lokasi & Waktu */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">II. Lokasi & Waktu Kejadian</h3><p className="text-[10px] text-slate-500 font-semibold">Untuk memetakan unit kerja yang dievaluasi</p></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-600 mb-1 block">Tanggal Kejadian <span className="text-red-500">*</span></label><input type="date" value={form.tglKejadian} onChange={e => set('tglKejadian', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 mb-1 block">Jam Kejadian (WIB)</label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={form.jamKejadian ? form.jamKejadian.split(':')[0] : ''}
                                            onChange={e => {
                                                const minute = form.jamKejadian ? form.jamKejadian.split(':')[1] : '00'
                                                set('jamKejadian', `${e.target.value}:${minute}`)
                                            }}
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        >
                                            <option value="" disabled>Jam</option>
                                            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                        <span className="text-lg font-bold text-slate-400">:</span>
                                        <select
                                            value={form.jamKejadian ? form.jamKejadian.split(':')[1] : ''}
                                            onChange={e => {
                                                const hour = form.jamKejadian ? form.jamKejadian.split(':')[0] : '00'
                                                set('jamKejadian', `${hour}:${e.target.value}`)
                                            }}
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        >
                                            <option value="" disabled>Menit</option>
                                            {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-600 block">Unit / Lokasi yang Dikeluhkan <span className="text-red-500">*</span></label>
                                    {isUnitLocked && (
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            🔒 Terkunci via QR Code
                                        </span>
                                    )}
                                </div>
                                {isUnitLocked ? (
                                    <div className="w-full bg-emerald-50/70 border border-emerald-300 rounded-xl px-4 py-3.5 text-sm font-black text-emerald-950 flex items-center justify-between shadow-2xs">
                                        <span>{lockedUnitName || 'Unit Terpilih'}</span>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                                            Otomatis
                                        </span>
                                    </div>
                                ) : (
                                    <select value={form.unitLokasi} onChange={e => set('unitLokasi', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                                        <option value="" disabled>Pilih Unit Kerja...</option>
                                        {unitOptions.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                                        <option value="Lainnya">Lainnya</option>
                                    </select>
                                )}
                                {!isUnitLocked && form.unitLokasi === 'Lainnya' && <input value={form.unitLokasiLain} onChange={e => set('unitLokasiLain', e.target.value)} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Sebutkan lokasi..." />}
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setStep(1)} className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
                                <button type="button" onClick={() => setStep(3)} disabled={!canProceed2} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-slate-800">Lanjutkan &rarr;</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Kategori */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><ListChecks className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">III. Kategori Komplain (Apa)</h3><p className="text-[10px] text-slate-500 font-semibold">Pilih satu atau lebih untuk mengelompokkan masalah</p></div>
                            </div>
                            <div className="space-y-3">
                                {KATEGORI_KOMPLAIN.map(k => (
                                    <label key={k.value} className={cn("flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all text-slate-800", form.kategori.includes(k.value) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-200 hover:bg-slate-50")}>
                                        <input type="checkbox" className="mt-0.5 accent-emerald-600 w-4 h-4" checked={form.kategori.includes(k.value)} onChange={() => toggleArr('kategori', k.value)} />
                                        <div><p className="text-sm font-bold text-slate-700">{k.label}</p><p className="text-xs text-slate-500 mt-0.5">{k.desc}</p></div>
                                    </label>
                                ))}
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setStep(2)} className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
                                <button type="button" onClick={() => setStep(4)} disabled={!canProceed3} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-slate-800">Lanjutkan &rarr;</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Uraian Keluhan */}
                    {step === 4 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">IV. Uraian Keluhan (Mengapa)</h3><p className="text-[10px] text-slate-500 font-semibold">Kronologi kejadian secara singkat</p></div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-2 block">Detail Kejadian <span className="text-red-500">*</span></label>
                                <p className="text-xs text-slate-500 mb-3">Sebutkan nama petugas jika ingat, atau poin utama masalahnya. Min 20 karakter.</p>
                                <textarea value={form.detailKejadian} onChange={e => set('detailKejadian', e.target.value)} rows={5} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-slate-900" placeholder="Ceritakan kronologi..." />
                                <p className="text-[10px] text-slate-400 mt-1 text-right">{form.detailKejadian.length} karakter</p>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setStep(3)} className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
                                <button type="button" onClick={() => setStep(5)} disabled={!canProceed4} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 transition-all hover:bg-slate-800">Lanjutkan &rarr;</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Harapan & Submit */}
                    {step === 5 && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
                                <div><h3 className="font-bold text-slate-800 text-sm">V. Harapan Pelanggan</h3><p className="text-[10px] text-slate-500 font-semibold">Solusi yang diharapkan</p></div>
                            </div>
                            <div className="space-y-2">
                                {HARAPAN_OPTIONS.map(opt => (
                                    <label key={opt} className={cn("flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all text-sm font-medium text-slate-800", form.harapan.includes(opt) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-200 hover:bg-slate-50")}>
                                        <input type="checkbox" className="accent-emerald-600 w-4 h-4" checked={form.harapan.includes(opt)} onChange={() => toggleArr('harapan', opt)} /><span>{opt}</span>
                                    </label>
                                ))}
                                {form.harapan.includes('Lainnya') && <input value={form.harapanLain} onChange={e => set('harapanLain', e.target.value)} className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 text-slate-900" placeholder="Sebutkan harapan Anda..." />}
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setStep(4)} className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
                                <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-3.5 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-80 transition-all drop-shadow-md cursor-pointer">
                                    {isSubmitting ? 'Mengamankan Data...' : 'Kirim Komplain'}
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
