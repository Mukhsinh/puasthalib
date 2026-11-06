# PUAS (Kanal Aduan, Survey, dan Informasi Terintegrasi)
> **Platform Pelayanan Terpadu Rumah Sakit Umum Daerah Bendan / Fasilitas Pelayanan Publik**

Aplikasi modern berbasis web untuk mengelola pengaduan pasien, pengukuran survei kepuasan masyarakat (IKM Permenpan RB No. 14 Tahun 2017), keterbukaan permohonan informasi publik (UU KIP), dan whistleblowing internal yang terintegrasi secara *real-time*.

---

## 📑 Dokumentasi Resmi

Dokumentasi teknis komprehensif, arsitektur sistem, skema basis data, modul aplikasi, flowchart standar ANSI/ISO, dan formulasi matematis IKM dapat dibaca pada:
👉 **[DOKUMENTASI_LENGKAP.md](./DOKUMENTASI_LENGKAP.md)**

---

## 🚀 Fitur Unggulan

### 🌐 Kanal Publik (Pasien & Pengunjung)
- **Beranda Terintegrasi (`/`)**: Navigasi cepat, jadwal sholat lokal real-time, FAQ interaktif, ulasan testimoni marquee.
- **Survei Kepuasan Masyarakat (`/survei`)**: 11 Unsur Indikator Pelayanan Standar Permenpan RB No. 14/2017 & demografi responden.
- **Formulir Pengaduan / Komplain (`/komplain`)**: Form 5 tahap terstruktur, penomoran tiket unik (`KOM-xxxxx`), dan harapan solusi pasien.
- **Permintaan Informasi Publik (`/informasi`)**: Standar Formulir Permintaan Informasi Rumah Sakit (FPI-RS) UU KIP dengan SLA 1x24 jam kerja.
- **Whistleblowing Internal (`/aduan-internal`)**: Saluran tertutup bagi staf RS dengan opsi pelapor anonim.
- **Lacak Status Tiket (`/lacak`)**: Pengecekan status pengerjaan tiket dan log riwayat tindak lanjut secara transparan.

### 🛡️ Backoffice Administrator (`/admin`)
- **Keamanan Sesi (`/login`)**: Opsi *Stay Signed In* (30 hari) vs *Auto-timeout* inaktivitas 30 menit, toggle lihat password.
- **Dashboard Eksekutif (`/admin`)**: Metrik KPI tiket, rasio status penyelesaian, grafik tren waktu, notifikasi real-time.
- **Manajemen Tiket (`/admin/tiket`)**: Filter per unit kerja, detail komplain, update status, dan ekspor laporan resmi (PDF ber-cover + Excel).
- **Analisa Pelaporan (`/admin/analisa`)**: Tren volume laporan, rasio kategori aduan, dan komparasi performa.
- **Analisis Kepuasan (`/admin/analisis-kepuasan`)**: Skor IKM Global, Predikat Mutu (A/B/C/D), speedometer gauge 11 unsur $U_1$ s.d. $U_{11}$, ekspor SKM Permenpan RB.
- **Master Unit Kerja (`/admin/unit`)**: Manajemen poliklinik & ruangan, unduh template excel, impor batch data excel cerdas.
- **Master QR Code (`/admin/qrcode`)**: Generator QR unit untuk 4 mode (Gabungan, Survei, Komplain, Informasi), ekspor PNG HD, cetak kartu akrilik stand meja loket (PDF). Saat dipindai, unit otomatis terkunci (*lock unit*).
- **Pengaturan & Buku Panduan (`/admin/pengaturan`)**: Konfigurasi identitas RS, backup database, generator PDF Buku Pedoman Teknis & Flowchart ANSI/ISO.

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling & Animasi**: Tailwind CSS v4, Framer Motion, Lucide Icons
- **Visualisasi & Diagram**: Recharts, SVG Speedometer Gauge
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth SSR, RLS, Realtime)
- **Ekspor Dokumen**: jsPDF, jsPDF-AutoTable, XLSX (SheetJS), QRCode, HTML2Canvas

---

## ⚡ Memulai Pengembangan

1. **Prasyarat**: Node.js 18+ terpasang di komputer Anda.
2. **Setup Konfigurasi**:
   Pastikan file `.env.local` telah terkonfigurasi:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_SUPABASE_ID].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
   ```
3. **Instalasi Paket**:
   ```bash
   npm install
   ```
4. **Menjalankan Server Lokal**:
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) pada browser Anda.
5. **Kompilasi Versi Produksi**:
   ```bash
   npm run build
   npm start
   ```

---
*Pengembangan Sistem PUAS - Solusi Pelayanan Terpadu & Akuntabel.*
