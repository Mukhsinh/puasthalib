import { SupabaseClient } from '@supabase/supabase-js'

export interface AppSettingsData {
    kop_nama: string;
    kop_rs: string;
    kop_alamat: string;
    kop_kontak: string;
    nama_penandatangan: string;
    jabatan_penandatangan: string;
    whatsapp_kontak: string;
    app_name: string;
    app_footer_text: string;
    app_logo: string;
}

export const DEFAULT_APP_SETTINGS: AppSettingsData = {
    kop_nama: 'Pemerintah Kota Sejahtera',
    kop_rs: 'Rumah Sakit Umum Daerah',
    kop_alamat: 'Jl. Jend. Sudirman No. 123',
    kop_kontak: 'Email: rsud@sejahtera.go.id | Website: rsud.sejahtera.go.id',
    nama_penandatangan: 'Dr. Mulyadi Saputra, MARS',
    jabatan_penandatangan: 'Direktur Utama RSUD Kota Sejahtera',
    whatsapp_kontak: '',
    app_name: 'PUAS',
    app_footer_text: 'PINTAR PUAS @2026. Mukhsin Hadi. All Right Reserved.',
    app_logo: ''
}

/**
 * Utility helper to fetch and map app settings from Supabase cleanly.
 */
export async function fetchAppSettings(supabase: SupabaseClient): Promise<AppSettingsData> {
    try {
        const { data } = await supabase.from('app_settings').select('setting_key, setting_value')
        if (!data || data.length === 0) return DEFAULT_APP_SETTINGS

        const settingsMap: Record<string, string> = {}
        data.forEach((s: { setting_key: string; setting_value: string }) => {
            if (s.setting_key && s.setting_value !== undefined) {
                settingsMap[s.setting_key] = s.setting_value
            }
        })

        return {
            kop_nama: settingsMap['nama_instansi'] || DEFAULT_APP_SETTINGS.kop_nama,
            kop_rs: settingsMap['nama_sub_instansi'] || DEFAULT_APP_SETTINGS.kop_rs,
            kop_alamat: settingsMap['alamat_instansi'] || DEFAULT_APP_SETTINGS.kop_alamat,
            kop_kontak: settingsMap['kontak_instansi'] || DEFAULT_APP_SETTINGS.kop_kontak,
            nama_penandatangan: settingsMap['nama_penandatangan'] || DEFAULT_APP_SETTINGS.nama_penandatangan,
            jabatan_penandatangan: settingsMap['jabatan_penandatangan'] || DEFAULT_APP_SETTINGS.jabatan_penandatangan,
            whatsapp_kontak: settingsMap['whatsapp_kontak'] || DEFAULT_APP_SETTINGS.whatsapp_kontak,
            app_name: settingsMap['app_name'] || DEFAULT_APP_SETTINGS.app_name,
            app_footer_text: settingsMap['app_footer_text'] || DEFAULT_APP_SETTINGS.app_footer_text,
            app_logo: settingsMap['app_logo'] || DEFAULT_APP_SETTINGS.app_logo
        }
    } catch (error) {
        console.error('Failed to fetch app settings:', error)
        return DEFAULT_APP_SETTINGS
    }
}
