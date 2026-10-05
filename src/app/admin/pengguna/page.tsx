'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Users, Plus, ShieldAlert, Edit, X, Save, Lock, CheckCircle2, AlertCircle, UserPlus, Search, Eye, EyeOff, Mail, KeyRound, User, Building2, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { useRouter } from 'next/navigation'

export default function AdminPenggunaPage() {
    const [profiles, setProfiles] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [checkingAuth, setCheckingAuth] = useState(true)

    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const [formData, setFormData] = useState({ id: '', nama_lengkap: '', role: 'user', unit_id: '', whatsapp: '' })
    const [addFormData, setAddFormData] = useState({ nama_lengkap: '', email: '', password: '', role: 'user', unit_id: '', whatsapp: '' })

    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const supabase = createClient()
    const router = useRouter()

    const showToast = (type: 'success' | 'error', text: string) => {
        setSaveMessage({ type, text })
        setTimeout(() => setSaveMessage(null), 4000)
    }

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    setCurrentUserId(session.user.id)
                    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
                    if (profile?.role) {
                        setCurrentUserRole(profile.role)
                    } else {
                        const metaRole = session.user.user_metadata?.role
                        setCurrentUserRole(metaRole || 'admin')
                    }
                } else {
                    // Fallback role gracefully without force-redirecting on mount
                    setCurrentUserRole('admin')
                }
            } catch {
                setCurrentUserRole('admin')
            } finally {
                setCheckingAuth(false)
            }
        }
        checkAuth()
    }, [router, supabase])

    const fetchProfiles = useCallback(async () => {
        setIsLoading(true)
        const { data } = await supabase.from('profiles').select('*, units!unit_id(nama)').order('created_at', { ascending: false })
        setProfiles(data || [])
        setIsLoading(false)
    }, [supabase])

    const fetchUnits = useCallback(async () => {
        const { data } = await supabase.from('units').select('id, nama').order('nama', { ascending: true })
        setUnits(data || [])
    }, [supabase])

    useEffect(() => {
        if (currentUserRole && ['superadmin', 'admin'].includes(currentUserRole)) {
            fetchProfiles()
            fetchUnits()
        }
    }, [currentUserRole, fetchProfiles, fetchUnits])

    // ======== HANDLERS ========

    const handleOpenEdit = (user: any) => {
        setFormData({ id: user.id, nama_lengkap: user.nama_lengkap || '', role: user.role || 'user', unit_id: user.unit_id || '', whatsapp: user.whatsapp || '' })
        setIsEditModalOpen(true)
    }

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        const { error } = await supabase.from('profiles').update({
            nama_lengkap: formData.nama_lengkap,
            role: formData.role,
            whatsapp: formData.whatsapp,
            unit_id: formData.unit_id || null
        }).eq('id', formData.id)

        if (error) { showToast('error', 'Gagal menyimpan: ' + error.message) }
        else {
            showToast('success', 'Profil berhasil diperbarui');
            fetchProfiles()
        }
        setIsSaving(false)
        setIsEditModalOpen(false)
    }

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!addFormData.email || !addFormData.password || !addFormData.nama_lengkap) {
            showToast('error', 'Mohon lengkapi semua field wajib')
            return
        }
        if (addFormData.password.length < 6) {
            showToast('error', 'Password minimal 6 karakter')
            return
        }

        setIsSaving(true)
        try {
            // Get current session token for authorization
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                showToast('error', 'Sesi telah berakhir. Silakan login ulang.')
                setIsSaving(false)
                return
            }

            // Call edge function to create user (avoids logging out current admin)
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-create-user`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    },
                    body: JSON.stringify({
                        email: addFormData.email,
                        password: addFormData.password,
                        nama_lengkap: addFormData.nama_lengkap,
                        role: addFormData.role,
                        whatsapp: addFormData.whatsapp,
                        unit_id: addFormData.unit_id || null
                    })
                }
            )

            const result = await response.json()

            if (!response.ok || result.error) {
                showToast('error', result.error || 'Gagal membuat pengguna')
            } else {
                showToast('success', `Pengguna "${addFormData.nama_lengkap}" berhasil dibuat!`)
                setAddFormData({ nama_lengkap: '', email: '', password: '', role: 'user', unit_id: '', whatsapp: '' })
                setIsAddModalOpen(false)
                fetchProfiles()
            }
        } catch (err: any) {
            showToast('error', 'Error: ' + (err.message || 'Unknown'))
        }
        setIsSaving(false)
    }

    const handleToggleActive = async (userId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus
        const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', userId)
        if (error) { showToast('error', 'Gagal mengubah status: ' + error.message) }
        else {
            showToast('success', newStatus ? 'Pengguna diaktifkan' : 'Pengguna dinonaktifkan')
            fetchProfiles()
        }
    }

    // ======== HELPERS ========
    const filteredProfiles = profiles.filter(p => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (p.nama_lengkap || '').toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q) || (p.units?.nama || '').toLowerCase().includes(q)
    })

    const getRoleBadge = (role: string) => {
        const map: Record<string, string> = {
            superadmin: 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border-purple-200',
            admin: 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200',
            direktur: 'bg-rose-50 text-rose-600 border-rose-200',
            manajer: 'bg-amber-50 text-amber-600 border-amber-200',
            supervisor: 'bg-indigo-50 text-indigo-600 border-indigo-200',
            user: 'bg-blue-50 text-blue-600 border-blue-200'
        }
        return map[role] || map.user
    }

    // ======== RENDER ========

    if (checkingAuth) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-slate-500 font-medium text-sm">Memverifikasi akses...</p>
            </div>
        )
    }

    if (!currentUserRole || !['superadmin', 'admin'].includes(currentUserRole)) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] max-w-lg mx-auto text-center space-y-6">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center"><Lock className="w-12 h-12" /></div>
                <div><h2 className="text-3xl font-black text-slate-800">Akses Dibatasi</h2><p className="text-slate-500 font-medium mt-2">Hanya <strong>Admin</strong> atau <strong>Superadmin</strong> yang dapat mengakses halaman ini.</p></div>
                <button onClick={() => router.push('/admin')} className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors">Kembali</button>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative">
            {/* Toast */}
            <AnimatePresence>
                {saveMessage && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className={cn("fixed top-20 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold border",
                            saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                        {saveMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {saveMessage.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Master Pengguna</h1>
                    <p className="text-sm text-slate-500 font-medium">Kelola akun, hak akses, dan penempatan unit kerja pengguna sistem.</p>
                </div>
                <button
                    onClick={() => { setAddFormData({ nama_lengkap: '', email: '', password: '', role: 'user', unit_id: '', whatsapp: '' }); setShowPassword(false); setIsAddModalOpen(true) }}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5"
                >
                    <UserPlus className="w-5 h-5" /> Tambah Pengguna Baru
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan nama, role, atau unit kerja..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">No</th>
                                <th className="px-6 py-4">Pengguna</th>
                                <th className="px-6 py-4">Hak Akses</th>
                                <th className="px-6 py-4">Unit Kerja</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={6} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                                        <p className="text-slate-400 font-medium text-sm">Mengambil data pengguna...</p>
                                    </div>
                                </td></tr>
                            ) : filteredProfiles.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <Users className="w-10 h-10 text-slate-200" />
                                        <p className="text-slate-400 font-medium">{searchQuery ? 'Tidak ditemukan.' : 'Belum ada pengguna.'}</p>
                                    </div>
                                </td></tr>
                            ) : (
                                filteredProfiles.map((user: any, idx: number) => {
                                    const isActive = user.is_active !== false
                                    return (
                                        <tr key={user.id} className={cn("transition-colors group", isActive ? "hover:bg-slate-50/50" : "bg-slate-50/30 opacity-60")}>
                                            <td className="px-6 py-4 text-slate-400 font-bold text-xs">{idx + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.nama_lengkap || user.id}&backgroundColor=eef2ff`} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{user.nama_lengkap || 'Tanpa Nama'}</p>
                                                        <p className="text-[11px] text-slate-400 font-medium">{user.email || user.id?.substring(0, 12) + '...'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border shadow-sm", getRoleBadge(user.role))}>
                                                    {user.role === 'superadmin' && <ShieldAlert className="w-3 h-3" />}
                                                    {user.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                                                    {user.role || 'user'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.role === 'superadmin' || user.role === 'admin' ? (
                                                    <span className="text-slate-400 italic text-xs">Global</span>
                                                ) : user.units?.nama ? (
                                                    <span className="font-semibold text-slate-700 text-xs bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">{user.units.nama}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                    isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200")}>
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-red-400")} />
                                                    {isActive ? 'Aktif' : 'Nonaktif'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => handleOpenEdit(user)} title="Edit"
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    {user.id !== currentUserId && (
                                                        <button onClick={() => handleToggleActive(user.id, isActive)} title={isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                                            className={cn("p-2 rounded-xl transition-all",
                                                                isActive ? "text-slate-400 hover:text-orange-600 hover:bg-orange-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50")}>
                                                            {isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {!isLoading && filteredProfiles.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <p className="text-xs text-slate-400 font-medium">Menampilkan {filteredProfiles.length} dari {profiles.length} pengguna</p>
                        <p className="text-xs text-slate-400 font-medium">{profiles.filter((p: any) => p.is_active !== false).length} aktif</p>
                    </div>
                )}
            </div>

            {/* ===== EDIT MODAL ===== */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                                <h3 className="font-extrabold text-slate-800 flex items-center gap-2"><Edit className="w-5 h-5 text-blue-500" /> Edit Pengguna</h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleSaveEdit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Lengkap</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input required value={formData.nama_lengkap} onChange={e => setFormData({ ...formData, nama_lengkap: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp</label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm border-r border-slate-200 pr-2">+62</div>
                                        <input type="text" value={formData.whatsapp} onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '')
                                            setFormData({ ...formData, whatsapp: val })
                                        }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-16 pr-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Hak Akses</label>
                                        <select value={formData.role} onChange={e => { setFormData({ ...formData, role: e.target.value }); }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                                            <option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Unit Kerja Utama</label>
                                        <select value={formData.unit_id} onChange={e => setFormData({ ...formData, unit_id: e.target.value })}
                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                                            <option value="">— Global —</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50">
                                        <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ===== ADD USER MODAL ===== */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">

                            {/* Modal Header with gradient */}
                            <div className="px-8 pt-8 pb-6 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-b border-slate-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-200/20 to-transparent rounded-full -translate-y-8 translate-x-8" />
                                <div className="flex items-start justify-between relative">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                            <UserPlus className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-xl text-slate-800">Tambah Pengguna Baru</h3>
                                            <p className="text-xs text-slate-500 font-medium mt-0.5">Buat akun autentikasi lengkap dengan profil pengguna</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-full transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Form Body */}
                            <form onSubmit={handleAddUser} className="p-8 space-y-6">
                                {/* Nama Lengkap */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <User className="w-3 h-3" /> Nama Lengkap <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input required value={addFormData.nama_lengkap} onChange={e => setAddFormData({ ...addFormData, nama_lengkap: e.target.value })}
                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-300"
                                            placeholder="Masukkan nama lengkap pengguna" />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Mail className="w-3 h-3" /> Email <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input required type="email" value={addFormData.email} onChange={e => setAddFormData({ ...addFormData, email: e.target.value })}
                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-300"
                                            placeholder="email@contoh.com" />
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <KeyRound className="w-3 h-3" /> Password <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input required type={showPassword ? 'text' : 'password'} value={addFormData.password} onChange={e => setAddFormData({ ...addFormData, password: e.target.value })}
                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-12 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-300"
                                            placeholder="Minimal 6 karakter" minLength={6} />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors">
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Password harus minimal 6 karakter.</p>
                                </div>

                                {/* WhatsApp */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        Nomor WhatsApp
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm border-r border-slate-200 pr-2">+62</div>
                                        <input type="text" value={addFormData.whatsapp} onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '')
                                            setAddFormData({ ...addFormData, whatsapp: val })
                                        }}
                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-16 pr-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all placeholder:text-slate-300"
                                            placeholder="81234567890" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Contoh: 81223334444 (tanpa angka 0 di depan)</p>
                                </div>

                                {/* Role & Unit */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <ShieldCheck className="w-3 h-3" /> Hak Akses
                                        </label>
                                        <select value={addFormData.role} onChange={e => { setAddFormData({ ...addFormData, role: e.target.value }); }}
                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all">
                                            <option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <Building2 className="w-3 h-3" /> Unit Kerja Utama
                                        </label>
                                        <select value={addFormData.unit_id} onChange={e => setAddFormData({ ...addFormData, unit_id: e.target.value })}
                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all">
                                            <option value="">— Global —</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
                                        </select>
                                    </div>
                                </div>


                                {/* Actions */}
                                <div className="pt-5 flex justify-end gap-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsAddModalOpen(false)}
                                        className="px-5 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                                        Batal
                                    </button>
                                    <button type="submit" disabled={isSaving}
                                        className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0">
                                        {isSaving ? (
                                            <><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Membuat Akun...</>
                                        ) : (
                                            <><Plus className="w-5 h-5" /> Buat Pengguna</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
