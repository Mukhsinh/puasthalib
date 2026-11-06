'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Send, Sparkles, User, Settings, Info, Briefcase, GraduationCap, Building } from 'lucide-react'
import Link from 'next/link'
import FormHeader from '@/components/FormHeader'
import BottomNav from '@/components/BottomNav'
import AppFooter from '@/components/AppFooter'
import TicketSuccess from '@/components/TicketSuccess'
import FloatingLabelInput from '@/components/FloatingLabelInput'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/utils/cn'
import { createClient } from '@/utils/supabase/client'

// -- REGULATORY STANDARDS QUESTIONS (IKM - 11 Indicators) --
const SURVEY_QUESTIONS = [
    { id: 'q1', title: 'Persyaratan', text: "Bagaimana pendapat Saudara tentang kesesuaian persyaratan pelayanan dengan jenis pelayanannya?" },
    { id: 'q2', title: 'Prosedur', text: "Bagaimana pemahaman Saudara tentang kemudahan prosedur pelayanan di unit ini?" },
    { id: 'q3', title: 'Waktu Pelayanan', text: "Bagaimana pendapat Saudara tentang kecepatan waktu dalam memberikan pelayanan?" },
    { id: 'q4', title: 'Biaya / Tarif', text: "Bagaimana pendapat Saudara tentang kewajaran biaya/tarif dalam pelayanan?" },
    { id: 'q5', title: 'Produk Spesifikasi', text: "Bagaimana pendapat Saudara tentang kesesuaian produk pelayanan antara yang tercantum dalam standar pelayanan dengan hasil yang diberikan?" },
    { id: 'q6', title: 'Kompetensi Pelaksana', text: "Bagaimana pendapat Saudara tentang kompetensi/kemampuan petugas dalam pelayanan?" },
    { id: 'q7', title: 'Perilaku Pelaksana', text: "Bagaimana pendapat Saudara mengenai perilaku petugas dalam pelayanan terkait kesopanan dan keramahan?" },
    { id: 'q8', title: 'Sarana dan Prasarana', text: "Bagaimana pendapat Saudara tentang kualitas sarana dan prasarana pendukung pelayanan?" },
    { id: 'q9', title: 'Penanganan Pengaduan', text: "Bagaimana pendapat Saudara tentang prosedur penanganan pengaduan pengguna layanan?" },
    { id: 'q10', title: 'Transparansi Pelayanan', text: "Bagaimana pendapat Saudara tentang transparansi pelayanan yang diberikan? (kecukupan informasi)" },
    { id: 'q11', title: 'Integritas Petugas', text: "Bagaimana pendapat Saudara tentang integritas petugas pelayanan? (terkait penolakan terhadap suap, dll)" }
]

const EMOJI_SCALE = [
    { value: 1, label: "Tidak Baik" },
    { value: 2, label: "Kurang Baik" },
    { value: 3, label: "Baik" },
    { value: 4, label: "Sangat Baik" }
]

// -- DEMOGRAPHIC OPTIONS --
const UMUR_OPTIONS = ['< 20 Tahun', '20 - 29 Tahun', '30 - 39 Tahun', '40 - 49 Tahun', '≥ 50 Tahun']
const GENDER_OPTIONS = ['Laki-Laki', 'Perempuan']
const PENDIDIKAN_OPTIONS = ['SD / Sederajat', 'SMP / Sederajat', 'SMA / SMK / Sederajat', 'Diploma (D1/D2/D3/D4)', 'S1', 'S2 / S3', 'Lainnya']
const PEKERJAAN_OPTIONS = ['PNS / P3K', 'TNI / POLRI', 'Karyawan Swasta', 'Wiraswasta / Pengusaha', 'Mahasiswa / Pelajar', 'Lainnya']

// -- ZOD SCHEMA --
const surveySchema = z.object({
    unitId: z.string().min(1, { message: "Silakan pilih unit layanan." }),
    nama: z.string().min(3, { message: "Wajib diisi, min 3 karakter." }),
    hp: z.string().min(9, { message: "Nomor handphone tidak valid." }),
    alamat: z.string().min(5, { message: "Wajib diisi secara jelas." }),
    umur: z.string().min(1, { message: "Wajib mengisi umur." }),
    gender: z.string().min(1, { message: "Wajib mengisi jenis kelamin." }),
    pendidikan: z.string().min(1, { message: "Wajib memilih pendidikan." }),
    pekerjaan: z.string().min(1, { message: "Wajib memilih pekerjaan." }),
    ratings: z.record(z.string(), z.number().min(1).max(4)),
    feedback: z.string().optional()
})

type SurveyFormData = z.infer<typeof surveySchema>

export default function SurveiPage() {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [ticketNumber, setTicketNumber] = useState<string | null>(null)
    const [units, setUnits] = useState<any[]>([])
    const [isUnitLocked, setIsUnitLocked] = useState(false)
    const [lockedUnitName, setLockedUnitName] = useState('')

    const { control, handleSubmit, register, formState: { errors }, watch, setValue } = useForm<SurveyFormData>({
        resolver: zodResolver(surveySchema),
        defaultValues: {
            unitId: '',
            nama: '',
            hp: '',
            alamat: '',
            umur: '',
            gender: '',
            pendidikan: '',
            pekerjaan: '',
            ratings: {},
            feedback: ''
        }
    })

    // Fetch master units dynamically and check URL QR Code lock!
    useEffect(() => {
        const fetchUnits = async () => {
            const supabase = createClient()
            const { data } = await supabase.from('units').select('id, nama').order('nama')
            if (data) {
                setUnits(data)

                if (typeof window !== 'undefined') {
                    const params = new URLSearchParams(window.location.search)
                    const uId = params.get('unitId')
                    const lock = params.get('lockUnit') === 'true'

                    if (uId) {
                        setValue('unitId', uId)
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
    }, [setValue])

    const watchAll = watch()
    const ratings = watchAll.ratings || {}
    const isStep1Complete = !!watchAll.unitId && !!watchAll.nama && !!watchAll.hp && !!watchAll.alamat && !!watchAll.umur && !!watchAll.gender && !!watchAll.pendidikan && !!watchAll.pekerjaan
    const isRatingComplete = SURVEY_QUESTIONS.every(q => ratings[q.id] !== undefined)

    const onSubmit = async (data: SurveyFormData) => {
        setIsSubmitting(true)
        const supabase = createClient()

        // Buat tracking number
        const trackNo = `SRV-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`

        const payload = {
            tracking_number: trackNo,
            jenis: 'survei',
            status: 'Terkirim',
            unit_id: data.unitId,
            data_payload: data
        }

        const { error } = await supabase.from('tickets').insert(payload)

        setTimeout(() => {
            setIsSubmitting(false)
            if (!error) setTicketNumber(trackNo)
            else alert('Terjadi kesalahan saat mengirim data. Silakan coba lagi. ' + error.message)
        }, 1000)
    }

    if (ticketNumber) {
        return <TicketSuccess trackingNumber={ticketNumber} title="Terima Kasih!" message="Data kuesioner Anda telah berhasil tersimpan. Partisipasi Anda sangat berarti untuk peningkatan layanan." jenis="SURVEI KEPUASAN" />
    }

    return (
        <main className="min-h-screen pb-24 bg-slate-50 font-sans">
            <Link href="/" className="absolute top-6 left-6 z-20 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-700 border border-white/60 shadow-sm cursor-pointer hover:bg-white transition-colors">
                <ChevronLeft className="w-6 h-6" />
            </Link>

            <FormHeader
                title="Survei Kepuasan"
                subtitle="Sistem Survei Kepuasan Masyarakat Standar Permenpan RB"
                iconUrl="https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Clipboard/3D/clipboard_3d.png"
            />

            <div className="px-6 -mt-8 relative z-20">
                <div className="bg-white w-full rounded-[2rem] p-6 shadow-md shadow-slate-200/50 border border-slate-100">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                        {/* ===================== STEP 1: DEMOGRAFI ===================== */}
                        <div className={cn("transition-all duration-300", step !== 1 && "hidden opacity-0")}>
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shadow-inner">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 tracking-tight">Bagian I: Data Diri Responden</h3>
                                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Identitas & Latar Belakang</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Unit Target */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Building className="w-4 h-4 text-emerald-500" /> Unit Layanan yang Dinilai
                                        </label>
                                        {isUnitLocked && (
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                                🔒 Terkunci via QR Code
                                            </span>
                                        )}
                                    </div>
                                    <Controller
                                        name="unitId"
                                        control={control}
                                        render={({ field }) => (
                                            isUnitLocked ? (
                                                <div className="w-full bg-emerald-50/70 border border-emerald-300 rounded-xl px-4 py-3.5 text-sm font-black text-emerald-950 flex items-center justify-between shadow-2xs">
                                                    <span>{lockedUnitName || 'Unit Terpilih'}</span>
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                                                        Otomatis
                                                    </span>
                                                </div>
                                            ) : (
                                                <select {...field} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold !text-slate-900 outline-none transition-all">
                                                    <option value="" disabled>Pilih Unit Layanan...</option>
                                                    {units.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                                                </select>
                                            )
                                        )}
                                    />
                                    {errors.unitId && <p className="text-red-500 text-xs font-bold mt-1">{errors.unitId.message}</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <FloatingLabelInput label="Nama (Instansi/Perorangan)" {...register('nama')} />
                                        {errors.nama && <p className="text-red-500 text-xs font-bold mt-1 px-1">{errors.nama.message}</p>}
                                    </div>
                                    <div>
                                        <FloatingLabelInput label="Nomor WhatsApp/HP Aktif" type="tel" {...register('hp')} />
                                        {errors.hp && <p className="text-red-500 text-xs font-bold mt-1 px-1">{errors.hp.message}</p>}
                                    </div>
                                </div>

                                <div>
                                    <FloatingLabelInput label="Alamat Lengkap" {...register('alamat')} />
                                    {errors.alamat && <p className="text-red-500 text-xs font-bold mt-1 px-1">{errors.alamat.message}</p>}
                                </div>

                                {/* Custom Radio Group: Umur */}
                                <div className="space-y-2 pt-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Settings className="w-4 h-4 text-emerald-500" /> Rentang Umur</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                        {UMUR_OPTIONS.map(opt => (
                                            <label key={opt} className={cn("block text-center border p-2 rounded-lg text-xs font-bold cursor-pointer transition-all", watchAll.umur === opt ? "bg-primary text-white border-primary shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>
                                                <input type="radio" value={opt} className="hidden" {...register('umur')} />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                    {errors.umur && <p className="text-red-500 text-xs font-bold mt-1">{errors.umur.message}</p>}
                                </div>

                                {/* Custom Radio Group: Gender */}
                                <div className="space-y-2 pt-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><User className="w-4 h-4 text-emerald-500" /> Jenis Kelamin</label>
                                    <div className="flex gap-3">
                                        {GENDER_OPTIONS.map(opt => (
                                            <label key={opt} className={cn("flex-1 text-center border p-3 rounded-xl text-sm font-bold cursor-pointer transition-all", watchAll.gender === opt ? "bg-primary text-white border-primary shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>
                                                <input type="radio" value={opt} className="hidden" {...register('gender')} />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                    {errors.gender && <p className="text-red-500 text-xs font-bold mt-1">{errors.gender.message}</p>}
                                </div>

                                {/* Simple Selects for the rest */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-emerald-500" /> Pendidikan</label>
                                        <select {...register('pendidikan')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold !text-slate-900 outline-none transition-all">
                                            <option value="" disabled>Pilih Kualifikasi...</option>
                                            {PENDIDIKAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        {errors.pendidikan && <p className="text-red-500 text-xs font-bold mt-1">{errors.pendidikan.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Briefcase className="w-4 h-4 text-emerald-500" /> Pekerjaan</label>
                                        <select {...register('pekerjaan')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold !text-slate-900 outline-none transition-all">
                                            <option value="" disabled>Pilih Bidang...</option>
                                            {PEKERJAAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        {errors.pekerjaan && <p className="text-red-500 text-xs font-bold mt-1">{errors.pekerjaan.message}</p>}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    // Make sure validation doesn't block proceeding if we just check values (real validation happens onSubmit)
                                    setStep(2)
                                }}
                                disabled={!isStep1Complete}
                                className="mt-8 w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 transition-all drop-shadow-md hover:bg-slate-800"
                            >
                                Lanjutkan Kuesioner Inti &rarr;
                            </button>
                        </div>

                        {/* ===================== STEP 2: RATING PENILAIAN ===================== */}
                        <div className={cn("transition-all duration-300", step !== 2 && "hidden opacity-0")}>
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-inner">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 tracking-tight">Bagian II: Pendapat Responden</h3>
                                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">11 Indikator Kinerja SKM</p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                Berilah tanda pada kolom skala penilaian yang paling sesuai dengan kondisi sesungguhnya yang Anda alami. <b>1 = Sangat Tidak Sesuai</b> hingga <b>4 = Sangat Sesuai</b>.
                            </p>

                            <div className="space-y-6">
                                {SURVEY_QUESTIONS.map((q, qIndex) => (
                                    <div key={q.id} className="pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                                        <div className="mb-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-md mb-2 inline-block">Unsur {qIndex + 1}: {q.title}</span>
                                            <p className="text-sm font-bold text-slate-700 leading-snug">
                                                {q.text}
                                            </p>
                                        </div>

                                        <Controller
                                            name={`ratings.${q.id}` as any}
                                            control={control}
                                            render={({ field }) => (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                    {EMOJI_SCALE.map((scale) => (
                                                        <label
                                                            key={scale.value}
                                                            className={cn(
                                                                "flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all text-xs font-bold text-center select-none shadow-sm",
                                                                field.value === scale.value
                                                                    ? "bg-primary text-white border-primary ring-2 ring-primary/20 scale-[1.02]"
                                                                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                                                            )}
                                                        >
                                                            <input
                                                                type="radio"
                                                                className="hidden"
                                                                value={scale.value}
                                                                checked={field.value === scale.value}
                                                                onChange={() => field.onChange(scale.value)}
                                                            />
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={cn("text-lg", field.value === scale.value ? "opacity-100" : "opacity-40")}>{scale.value}</span>
                                                                <span className="text-[9px] uppercase tracking-wider">{scale.label}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold flex items-center hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5 mr-1" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStep(3)}
                                    disabled={!isRatingComplete}
                                    className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 transition-all drop-shadow-md hover:bg-slate-800"
                                >
                                    Isi Saran Final &rarr;
                                </button>
                            </div>
                        </div>

                        {/* ===================== STEP 3: FEEDBACK FINAL ===================== */}
                        <div className={cn("transition-all duration-300", step !== 3 && "hidden opacity-0")}>
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shadow-inner">
                                    <Info className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 tracking-tight">Bagian III: Saran & Masukan</h3>
                                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Tinjauan Analitatif</p>
                                </div>
                            </div>

                            <Controller
                                name="feedback"
                                control={control}
                                render={({ field }) => (
                                    <div className="relative mb-6">
                                        <label className="text-sm font-bold text-slate-700 mb-2 block">Masukan Perbaikan Pelayanan</label>
                                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">Mohon tuliskan saran evaluatif untuk membantu kami meningkatkan tingkat kepuasan layanan publik di masa mendatang.</p>
                                        <textarea
                                            {...field}
                                            rows={6}
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm !text-slate-900 resize-none font-semibold"
                                            placeholder="Opini, saran, kritik, atau pengalaman Anda..."
                                        />
                                    </div>
                                )}
                            />

                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold flex items-center hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5 mr-1" />
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3.5 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-80 transition-all drop-shadow-md cursor-pointer"
                                >
                                    {isSubmitting ? 'Mengamankan Data...' : 'Kirim Kuesioner'}
                                    {!isSubmitting && <Send className="w-4 h-4 ml-1" />}
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>

            <AppFooter />
            <BottomNav />
        </main>
    )
}
