'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Building2, Plus, Edit, Trash2, X, Save, CheckCircle2, AlertCircle, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminUnitPage() {
    const [units, setUnits] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({ id: '', nama: '', deskripsi: '' })
    const [isSaving, setIsSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const supabase = createClient()

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

    const router = useRouter()

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
        }
        checkAuth()
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                showToast('error', `Unit "${nama}" tidak dapat dihapus karena sudah digunakan di data lain.`)
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
            // UPDATE
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
            // INSERT
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

    const filteredUnits = units.filter(u => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (u.nama || '').toLowerCase().includes(q) || (u.deskripsi || '').toLowerCase().includes(q)
    })

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
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Master Unit Kerja</h1>
                    <p className="text-sm text-slate-500 font-medium">Kelola daftar unit/departemen di rumah sakit.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" /> Tambah Unit
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan nama atau deskripsi unit..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">No</th>
                                <th className="px-6 py-4">Nama Unit</th>
                                <th className="px-6 py-4">Deskripsi</th>
                                <th className="px-6 py-4">Tgl Dibuat</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                                            <p className="text-slate-400 font-medium text-sm">Mengambil data unit...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUnits.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Building2 className="w-10 h-10 text-slate-200" />
                                            <p className="text-slate-400 font-medium">{searchQuery ? 'Tidak ditemukan.' : 'Belum ada data unit kerja.'}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUnits.map((unit: any, idx: number) => (
                                    <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-slate-400 font-bold text-xs">{idx + 1}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                {unit.nama}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 max-w-[300px] truncate">{unit.deskripsi || <span className="text-slate-300 italic">—</span>}</td>
                                        <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                                            {unit.created_at ? new Date(unit.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handleOpenModal(unit)} title="Edit"
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(unit.id, unit.nama)} title="Hapus"
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
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
                {!isLoading && filteredUnits.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <p className="text-xs text-slate-400 font-medium">Menampilkan {filteredUnits.length} dari {units.length} unit</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                                <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-emerald-500" />
                                    {formData.id ? 'Edit Unit Kerja' : 'Tambah Unit Baru'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <form onSubmit={handleSave} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Unit <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        value={formData.nama}
                                        onChange={e => setFormData({ ...formData, nama: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        placeholder="Cth: Poli Umum"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Deskripsi</label>
                                    <textarea
                                        rows={3}
                                        value={formData.deskripsi}
                                        onChange={e => setFormData({ ...formData, deskripsi: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                                        placeholder="Keterangan unit (opsional)..."
                                    />
                                </div>
                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan'}
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
