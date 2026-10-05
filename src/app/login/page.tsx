'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LogIn, ShieldCheck, Mail, Lock, Sparkles, ArrowRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [appName, setAppName] = useState('PUAS')
    const [errorMessage, setErrorMessage] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
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

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) {
                setErrorMessage(error.message || 'Gagal melakukan otentikasi. Periksa email & password.')
                setIsLoading(false)
                return
            }

            if (data?.session) {
                // Ensure session cookies settle before navigation
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
                {/* Minimalist Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20 mb-4">
                        <ShieldCheck className="w-9 h-9" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Portal Administrasi</h1>
                    <p className="text-slate-500 font-medium text-xs mt-1">
                        Sistem Layanan Pengaduan & Survei {appName}
                    </p>
                </div>

                {/* Minimalist White Card */}
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-slate-200/80 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500" />

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
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                                />
                            </div>
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
