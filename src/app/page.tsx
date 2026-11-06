'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import AppFooter from '@/components/AppFooter'
import PrayerTimesBar from '@/components/PrayerTimesBar'
import { createClient } from '@/utils/supabase/client'
import {
  ClipboardCheck,
  MessageSquareWarning,
  SearchCheck,
  HelpCircle,
  ShieldAlert,
  Headphones,
  PlusCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react'

const MENUS = [
  {
    title: "Survei",
    speech: "Survei Kepuasan",
    icon: ClipboardCheck,
    delay: 0.05,
    href: "/survei",
    color: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/20"
  },
  {
    title: "Komplain Pasien",
    speech: "Komplain Pasien",
    icon: MessageSquareWarning,
    delay: 0.1,
    href: "/komplain",
    color: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/20"
  },
  {
    title: "Lacak Tiket",
    speech: "Lacak Tiket",
    icon: SearchCheck,
    delay: 0.15,
    href: "/lacak",
    color: "from-blue-600 to-indigo-600",
    shadow: "shadow-indigo-500/20"
  },
  {
    title: "Informasi",
    speech: "Permintaan Informasi",
    icon: HelpCircle,
    delay: 0.2,
    href: "/informasi",
    color: "from-yellow-400 to-amber-500",
    shadow: "shadow-amber-400/20"
  },
  {
    title: "Aduan Internal",
    speech: "Aduan Internal",
    icon: ShieldAlert,
    delay: 0.25,
    href: "/aduan-internal",
    color: "from-rose-500 to-red-600",
    shadow: "shadow-rose-500/20"
  },
  {
    title: "Kontak CS",
    speech: "Customer Service",
    icon: Headphones,
    delay: 0.3,
    href: "https://wa.me/1234567890",
    color: "from-emerald-400 to-green-600",
    shadow: "shadow-green-500/20"
  },
]

const FAQS = [
  { q: "Apa itu layanan PUAS?", a: "PUAS (Kanal Aduan, Survey, dan Informasi) adalah platform terintegrasi untuk memudahkan pasien dan masyarakat dalam menyampaikan keluhan, mengisi survei, dan meminta informasi secara transparan dan terpadu." },
  { q: "Bagaimana cara mengajukan komplain?", a: "Pilih menu 'Komplain Pasien' di beranda, lalu isi formulir dengan identitas Anda, kronologi kejadian, dan bukti pendukung. Laporan Anda akan menerima tiket untuk dilacak." },
  { q: "Bagaimana cara mengisi survei kepuasan?", a: "Pilih menu 'Survei' di beranda, lalu pilih poli atau layanan yang Anda kunjungi dan jawab pertanyaan sesuai dengan pengalaman Anda saat menerima pelayanan." },
  { q: "Bagaimana cara meminta informasi?", a: "Pilih menu 'Informasi', lengkapi formulir permohonan dengan detail informasi yang diinginkan. Tim kami akan mengevaluasi dan merespon secepatnya." },
  { q: "Bagaimana cara menghubungi petugas CS?", a: "Pilih menu 'Kontak CS' di beranda. Anda akan langsung diarahkan ke channel komunikasi resmi kami (WhatsApp) untuk chat dengan petugas." }
]

function timeAgo(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + " tahun yang lalu"
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + " bulan yang lalu"
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + " hari yang lalu"
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + " jam yang lalu"
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + " menit yang lalu"
  return "Baru saja"
}

const TESTIMONIALS = [
  { name: "Budi Santoso", text: "Pelayanan sangat memuaskan dan cepat tanggap. Dokter dan perawat sangat ramah.", rating: 5, time: "2 hari yang lalu" },
  { name: "Siti Aminah", text: "Fasilitas rumah sakit bersih dan nyaman. Proses pendaftaran juga sangat mudah melalui aplikasi ini.", rating: 5, time: "1 minggu yang lalu" },
  { name: "Andi Wijaya", text: "Terima kasih atas pelayanannya. Keluhan saya ditangani dengan cepat melalui sistem portal informasi PUAS.", rating: 4, time: "3 minggu yang lalu" },
  { name: "Rina Kusuma", text: "Sangat terbantu dengan adanya sistem informasi otomatis ini. Sukses terus untuk rumah sakit!", rating: 5, time: "1 bulan yang lalu" },
  { name: "Hendra Gunawan", text: "Respons dari customer service sangat cepat dan informatif. Mantap pelayanannya sangat profesional.", rating: 5, time: "1 bulan yang lalu" },
]

function speak(text: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'id-ID'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 0.8
    window.speechSynthesis.speak(utterance)
  }
}

export default function Beranda() {
  const [mounted, setMounted] = useState(false)
  const [appName, setAppName] = useState('PUAS')
  const [appLogo, setAppLogo] = useState('')
  const [namaInstansi, setNamaInstansi] = useState('')
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [greeting, setGreeting] = useState('Selamat Datang')
  const [qrQuery, setQrQuery] = useState('')
  const [qrUnitName, setQrUnitName] = useState<string | null>(null)

  const [testimonials, setTestimonials] = useState<any[]>([])
  const [isTestimoniOpen, setIsTestimoniOpen] = useState(false)
  const [tForm, setTForm] = useState({ name: '', text: '', rating: 5 })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
    const hour = new Date().getHours()
    if (hour >= 3 && hour < 11) setGreeting('Selamat Pagi')
    else if (hour >= 11 && hour < 15) setGreeting('Selamat Siang')
    else if (hour >= 15 && hour < 18) setGreeting('Selamat Sore')
    else setGreeting('Selamat Malam')

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const uId = params.get('unitId')
      const lock = params.get('lockUnit')
      if (uId) {
        const q = `?unitId=${encodeURIComponent(uId)}${lock ? '&lockUnit=' + encodeURIComponent(lock) : ''}`
        setQrQuery(q)

        const fetchUnit = async () => {
          const supabase = createClient()
          const { data } = await supabase.from('units').select('nama').eq('id', uId).single()
          if (data?.nama) {
            setQrUnitName(data.nama)
          }
        }
        fetchUnit()
      }
    }

    const initData = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('app_settings').select('*')
      if (data) {
        const _appName = data.find((d: any) => d.setting_key === 'app_name')?.setting_value
        const _appLogo = data.find((d: any) => d.setting_key === 'app_logo')?.setting_value
        const _namaSub = data.find((d: any) => d.setting_key === 'nama_sub_instansi')?.setting_value
        const _namaInstansi = data.find((d: any) => d.setting_key === 'nama_instansi')?.setting_value
        if (_appName) setAppName(_appName)
        if (_appLogo) setAppLogo(_appLogo)
        if (_namaSub) setNamaInstansi(_namaSub)
        else if (_namaInstansi) setNamaInstansi(_namaInstansi)
      }
      const { data: testData } = await supabase.from('testimoni').select('*').order('created_at', { ascending: false }).limit(20)
      if (testData && testData.length > 0) {
        setTestimonials(testData)
      } else {
        setTestimonials(TESTIMONIALS.map(t => ({ ...t, created_at: null })))
      }
    }
    initData()
  }, [])

  const submitTestimoni = async () => {
    if (!tForm.name || !tForm.text) return
    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('testimoni').insert([{ name: tForm.name, text: tForm.text, rating: tForm.rating }])
    if (error) {
      console.error('Testimoni insert error:', error)
      alert('Gagal menyimpan tanggapan: ' + error.message)
    } else {
      setIsTestimoniOpen(false)
      setTForm({ name: '', text: '', rating: 5 })
      const { data } = await supabase.from('testimoni').select('*').order('created_at', { ascending: false }).limit(20)
      if (data && data.length > 0) {
        setTestimonials(data)
      }
    }
    setIsSubmitting(false)
  }

  return (
    <main className="min-h-screen pb-24 font-sans bg-slate-50">

      {/* ===== HERO TOP HEADER (Matte Deep Cyan Background with Stylish Abstract Graphics) ===== */}
      <header className="relative pt-6 pb-10 px-5 sm:px-8 overflow-hidden bg-cyan-900 text-white shadow-sm">
        {/* Abstract graphic circles & vector shapes */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full border-[20px] border-white/10 pointer-events-none" />
        <div className="absolute top-1/2 -left-16 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-10 right-1/4 w-36 h-36 rounded-full border-[12px] border-white/10 pointer-events-none" />

        {/* Abstract grid texture */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" viewBox="0 0 400 400" preserveAspectRatio="none">
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="white" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Header Top Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3"
          >
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-11 h-11 rounded-2xl shadow-md object-cover border border-white/30 bg-white/20" />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shadow-md text-white">
                <ShieldCheck className="w-6 h-6" />
              </div>
            )}
            <div>
              <span className="text-xs font-semibold text-cyan-200 tracking-wider block">{mounted ? greeting : 'Selamat Datang'}</span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none mt-0.5">
                {namaInstansi || 'Rumah Sakit Umum Daerah Bendan'}
              </h1>
              <p className="text-[11px] font-medium text-cyan-200/90 tracking-wide uppercase mt-1">
                Kanal Aduan, Survey & Informasi Integratif
              </p>
            </div>
          </motion.div>
        </div>
      </header>

      {/* ===== MAIN CONTENT CONTAINER ===== */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">

        {/* ===== WAKTU SHOLAT BAR (Above Menu Layanan) ===== */}
        <PrayerTimesBar />

        {/* ===== QR CODE NOTICE BANNER (if accessed via QR Code) ===== */}
        {qrUnitName && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                📍
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Unit Layanan Terpilih (Akses QR Code)</p>
                <p className="text-sm font-black text-emerald-950">{qrUnitName}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200">
              🔒 Terkunci Otomatis
            </span>
          </div>
        )}

        {/* ===== MENU LAYANAN GRID (Stylish, Professional Non-Floating Vector Icons) ===== */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">Menu Utama Layanan</h2>
              <p className="text-xs text-slate-500 mt-0.5">Pilih layanan yang Anda perlukan di RSUD Bendan</p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            {MENUS.map((menu, idx) => {
              const MenuIcon = menu.icon
              const targetHref = ['/survei', '/komplain', '/informasi'].includes(menu.href) && qrQuery
                ? `${menu.href}${qrQuery}`
                : menu.href
              return (
                <Link key={idx} href={targetHref} className="outline-none" onClick={() => speak(menu.speech)}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: menu.delay, duration: 0.3 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group text-center"
                  >
                    {/* Stylish Non-Floating Vector Icon */}
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 mb-2.5 rounded-2xl bg-gradient-to-br ${menu.color} flex items-center justify-center text-white shadow-md ${menu.shadow} group-hover:scale-110 transition-transform duration-300`}>
                      <MenuIcon className="w-7 h-7 stroke-[2]" />
                    </div>

                    <span className="text-xs font-extrabold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                      {menu.title}
                    </span>
                  </motion.div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ===== MONITORING BANNER CARD (Matte Deep Slate Indigo) ===== */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full mb-10 rounded-2xl bg-indigo-900 p-5 sm:p-6 text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          {/* Decorative graphic circles */}
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-md">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Monitoring Penanganan Komplain Anda
            </h3>
            <p className="text-xs text-indigo-200 mt-1 leading-relaxed">
              Cek posisi, tindak lanjut, dan status penanganan tiket komplain Anda kapan saja dengan mudah.
            </p>
          </div>

          <Link href="/lacak" className="relative z-10 flex-shrink-0 flex items-center gap-2 bg-white text-indigo-950 font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm hover:bg-indigo-50 active:scale-95 transition-all">
            <span>Buka Lacak Tiket</span>
            <ArrowRight className="w-4 h-4 text-indigo-950" />
          </Link>
        </motion.div>

        {/* ===== FAQ SECTION (No 'Pusat Bantuan' Badge) ===== */}
        <div className="mb-12">
          <div className="flex flex-col items-center mb-5 text-center">
            <h2 className="text-lg sm:text-xl font-black text-slate-800">Pertanyaan Umum (FAQ)</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl border transition-all duration-200 ${openFAQ === idx ? 'border-blue-300 shadow-md ring-2 ring-blue-50' : 'border-slate-100 hover:border-slate-200 shadow-sm'
                  }`}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === idx ? null : idx)}
                  className="w-full py-4 px-5 flex items-center justify-between text-left focus:outline-none group"
                >
                  <span className={`font-bold text-sm transition-colors pr-4 ${openFAQ === idx ? 'text-blue-700' : 'text-slate-700 group-hover:text-blue-600'}`}>
                    {faq.q}
                  </span>
                  <div className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 ${openFAQ === idx ? 'bg-blue-100 text-blue-700 rotate-45' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                    }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  </div>
                </button>
                <AnimatePresence>
                  {openFAQ === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-xs text-slate-600 leading-relaxed overflow-hidden"
                    >
                      <div className="pb-4 px-5 pt-1 border-t border-slate-50">{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* ===== TESTIMONIAL SECTION ===== */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-slate-800">Testimoni Pengguna</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ulasan dari pengguna layanan rumah sakit</p>
            </div>
            <button
              onClick={() => setIsTestimoniOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-blue-200" />
              <span>Review Baru</span>
            </button>
          </div>

          <div className="relative flex w-full overflow-hidden pb-4 pt-1">
            <div className="flex animate-marquee cursor-default gap-4 px-2 hover:pause">
              {[...testimonials, ...testimonials].map((t, i) => (
                <div key={i} className="min-w-[270px] max-w-[270px] bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex-shrink-0">
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, star) => (
                      <svg key={star} className={`w-3.5 h-3.5 ${star < t.rating ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mb-3 line-clamp-3 leading-relaxed">"{t.text}"</p>
                  <div className="flex items-center justify-between mt-auto border-t border-slate-50 pt-2">
                    <span className="font-bold text-xs text-slate-800">{t.name}</span>
                    <span className="text-[10px] text-slate-400">{t.created_at ? timeAgo(t.created_at) : t.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      <AppFooter />
      <BottomNav />

      {/* Testimoni Modal */}
      <AnimatePresence>
        {isTestimoniOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsTestimoniOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden z-10 border border-slate-100">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">Tulis Tanggapan Anda</h3>
                <button onClick={() => setIsTestimoniOpen(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Nama <span className="text-red-500">*</span></label>
                  <input value={tForm.name} onChange={e => setTForm({ ...tForm, name: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" placeholder="Ketik nama Anda" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">Berapa bintang untuk kami?</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setTForm({ ...tForm, rating: star })} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${star <= tForm.rating ? 'bg-amber-100 text-amber-500' : 'bg-slate-50 border border-slate-200 text-slate-300 hover:text-slate-400'}`}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Tanggapan/Review <span className="text-red-500">*</span></label>
                  <textarea value={tForm.text} onChange={e => setTForm({ ...tForm, text: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none h-20" placeholder="Ketik pengalaman menggunakan layanan kami..." />
                </div>
                <button onClick={submitTestimoni} disabled={isSubmitting || !tForm.name || !tForm.text} className="w-full py-2.5 mt-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex justify-center items-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition">
                  {isSubmitting ? 'Menyimpan...' : 'Kirim Tanggapan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
        .hover\\:pause:hover {
          animation-play-state: paused;
        }
      `}</style>
    </main>
  )
}
