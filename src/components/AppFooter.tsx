'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { fetchAppSettings } from '@/utils/appSettings'

export default function AppFooter() {
    const [appName, setAppName] = useState('PUAS')
    const [footerText, setFooterText] = useState('PINTAR PUAS @2026. Mukhsin Hadi. All Right Reserved.')
    const [appLogo, setAppLogo] = useState('')

    const loadSettings = async () => {
        try {
            const supabase = createClient()
            const settings = await fetchAppSettings(supabase)
            if (settings.app_name) setAppName(settings.app_name)
            if (settings.app_footer_text) setFooterText(settings.app_footer_text)
            if (settings.app_logo) setAppLogo(settings.app_logo)
        } catch (e) {
            console.error("Footer fetch error:", e)
        }
    }

    useEffect(() => {
        loadSettings()

        const handleUpdate = () => loadSettings()
        window.addEventListener('app_settings_updated', handleUpdate)
        return () => window.removeEventListener('app_settings_updated', handleUpdate)
    }, [])

    return (
        <footer className="w-full py-6 px-6 bg-slate-200 border-t border-slate-300" style={{ marginBottom: '80px' }}>
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-3">
                    {appLogo ? (
                        <img src={appLogo} alt="Logo" className="w-9 h-9 object-contain rounded-lg shrink-0 shadow-sm" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-800 text-white font-black flex items-center justify-center text-sm shrink-0">
                            {appName.charAt(0)}
                        </div>
                    )}
                    <div>
                        <span className="text-sm font-black text-slate-800 tracking-wide block">{appName}</span>
                    </div>
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed tracking-wide">
                    {footerText || 'PINTAR PUAS @2026. Mukhsin Hadi. All Right Reserved.'}
                </p>
            </div>
        </footer>
    )
}
