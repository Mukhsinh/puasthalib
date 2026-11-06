'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Mail, Lock, ArrowRight, Eye, EyeOff, Check, Info } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [appName, setAppName] = useState('PUAS')
    const [errorMessage, setErrorMessage] = useState('')
    const [timeoutMessage, setTimeoutMessage] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [staySignedIn, setStaySignedIn] = useState(true) // Default stay signed in checked
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        // Cek jika ada notifikasi timeout di URL
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (params.get('timeout') === '1' || params.get('reason') === 'timeout') {
                setTimeoutMessage('Sesi login telah berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk kembali.')
            }

            // Baca preferensi stay signed in sebelumnya jika ada
            const savedStay = localStorage.getItem('puas_stay_signed_in')
            if (savedStay !== null) {
                setStaySignedIn(savedStay === 'true')
            }
        }

        const fetchAppName = async () => {
            const { data } = await supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', 'app_name')
                .single()
            if (data?.setting_value) setAppName(data.setting_value)
        }
        fetchAppName()
    }, [supabase])

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setErrorMessage('')
        setTimeoutMessage('')

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            })

            if (error) {
                setErrorMessage(error.message || 'Gagal melakukan otentikasi. Periksa email & password.')
                setIsLoading(false)
                return
            }

            if (data?.session) {
                // Simpan preferensi stay signed in ke localStorage & cookie
                if (typeof window !== 'undefined') {
                    localStorage.setItem('puas_stay_signed_in', staySignedIn ? 'true' : 'false')
                    // Catat aktivitas login awal
                    localStorage.setItem('puas_last_activity', Date.now().toString())

                    // Set cookie stay signed in untuk middleware (30 hari jika true, session jika false)
                    const maxAge = staySignedIn ? 60 * 60 * 24 * 30 : 60 * 60 * 24
                    document.cookie = `puas_stay_signed_in=${staySignedIn ? '1' : '0'}; path=/; max-age=${maxAge}; SameSite=Lax`
                }

                router.refresh()
                setTimeout(() => {
                    window.location.href = '/admin'
                }, 300)
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Terjadi kesalahan pada sistem login.')
            setIsLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Subtle background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md relative z-10"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20 mb-4">
                        <ShieldCheck className="w-9 h-9" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Portal Administrasi</h1>
                    <p className="text-slate-500 font-medium text-xs mt-1">
                        Sistem Layanan Pengaduan & Survei {appName}
                    </p>
                </div>

                {/* Minimalist Card */}
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-slate-200/80 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500" />

                    {timeoutMessage && (
                        <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{timeoutMessage}</span>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                                Email Pegawai
                            </label>
                            <div className="relative">
                                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nama@instansi.go.id"
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                                Kata Sandi
                            </label>
                            <div className="relative">
                                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 focus:outline-none transition-colors p-1"
                                    title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4 text-blue-600" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Fitur Stay Signed In (Tetap Masuk) */}
                        <div className="pt-1">
                            <label className="flex items-start gap-3 cursor-pointer group select-none">
                                <div className="relative flex items-center justify-center mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={staySignedIn}
                                        onChange={(e) => setStaySignedIn(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${staySignedIn
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30'
                                        : 'bg-slate-50 border-slate-300 group-hover:border-slate-400'
                                    }`}>
                                        {staySignedIn && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                                        Tetap Masuk (Stay Signed In)
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                        {staySignedIn
                                            ? 'Sesi tetap aktif otomatis, keluar hanya bila Anda menekan tombol Sign Out.'
                                            : 'Sesi akan otomatis berakhir jika tidak aktif selama 30 menit.'}
                                    </p>
                                </div>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 hover:from-blue-700 hover:via-teal-700 hover:to-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Memverifikasi...
                                </span>
                            ) : (
                                <>
                                    <span>Masuk Ke Sistem</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>

                        <div className="pt-4 border-t border-slate-100 text-center">
                            <p className="text-[11px] text-slate-400 font-semibold">
                                © {new Date().getFullYear()} {appName} Enterprise • Keamanan Terenkripsi
                            </p>
                        </div>
                    </form>
                </div>
            </motion.div>
        </main>
    )
}
