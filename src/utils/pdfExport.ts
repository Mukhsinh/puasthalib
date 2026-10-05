import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFExportOptions {
    title: string;
    subtitle?: string;
    filename: string;
    appSettings: {
        kop_nama: string;
        kop_rs: string;
        kop_alamat: string;
        kop_kontak: string;
        app_logo?: string;
    };
    printDate: string;
    signerName: string;
    signerRole: string;
    tableHeaders: string[];
    tableData: any[][];
    additionalInfo?: string[];
    additionalInfoBottom?: string[];
    tableHeadersBottom?: string[];
    tableDataBottom?: any[][];
}

export const generateFormalPDF = (options: PDFExportOptions) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const margin = 15;
    let yPos = margin;
    const pageWidth = doc.internal.pageSize.width;

    // --- KOP SURAT ---
    // Try to add logo if available
    if (options.appSettings.app_logo && options.appSettings.app_logo.startsWith('data:image')) {
        try {
            doc.addImage(options.appSettings.app_logo, 'PNG', margin, yPos - 2, 15, 15);
        } catch (e) {
            // Silently ignore logo errors
        }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(options.appSettings.kop_nama.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;

    doc.setFontSize(16);
    doc.text(options.appSettings.kop_rs.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(options.appSettings.kop_alamat, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(options.appSettings.kop_kontak, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Line separator
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 1;
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // --- TITLE ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(options.title.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    if (options.subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(options.subtitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
    }

    if (options.additionalInfo && options.additionalInfo.length > 0) {
        doc.setFontSize(10);
        options.additionalInfo.forEach(info => {
            doc.text(info, margin, yPos);
            yPos += 5;
        });
        yPos += 3;
    }

    // --- TABLE ---
    autoTable(doc, {
        startY: yPos,
        head: [options.tableHeaders],
        body: options.tableData,
        theme: 'striped',
        styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [47, 54, 64],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        margin: { left: margin, right: margin },
    });

    // @ts-ignore
    let finalY = doc.lastAutoTable.finalY + 10;

    if (options.additionalInfoBottom && options.additionalInfoBottom.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        options.additionalInfoBottom.forEach(info => {
            doc.text(info, margin, finalY);
            finalY += 5;
        });
        finalY += 3;
    }

    if (options.tableHeadersBottom && options.tableDataBottom) {
        autoTable(doc, {
            startY: finalY,
            head: [options.tableHeadersBottom],
            body: options.tableDataBottom,
            theme: 'striped',
            styles: {
                font: 'helvetica',
                fontSize: 9,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [47, 54, 64],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
            margin: { left: margin, right: margin },
        });
        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 15;
    } else {
        finalY += 5;
    }

    // Check if new page is needed for signature
    if (finalY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        finalY = margin + 10;
    }

    const todayDate = new Date(options.printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const location = options.appSettings.kop_nama.replace('Pemerintah ', '').replace('Provinsi ', '').replace('Kabupaten ', '');
    const signatureText = `${location}, ${todayDate}`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    // Align to right side
    const rightSideX = pageWidth - margin - 45;
    doc.text(signatureText, rightSideX, finalY, { align: 'center' });
    finalY += 25;

    doc.setFont('helvetica', 'bold');
    doc.text(options.signerName, rightSideX, finalY, { align: 'center' });
    // Underline
    const signerWidth = doc.getTextWidth(options.signerName);
    doc.line(rightSideX - (signerWidth / 2), finalY + 1, rightSideX + (signerWidth / 2), finalY + 1);

    finalY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(options.signerRole, rightSideX, finalY, { align: 'center' });

    doc.save(options.filename);
};

export interface SystemOverviewOptions {
    appSettings: any;
    printDate: string;
}

export const generateSystemOverviewPDF = (options: SystemOverviewOptions) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    const addPageNumber = (pageNumber: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Halaman ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    // --- COVER PAGE ---
    // Background decoration
    doc.setFillColor(47, 54, 64);
    doc.rect(0, 0, pageWidth, 60, 'F');

    // Try to add logo on cover
    if (options.appSettings.app_logo && options.appSettings.app_logo.startsWith('data:image')) {
        try {
            doc.addImage(options.appSettings.app_logo, 'PNG', pageWidth / 2 - 10, 70, 20, 20);
        } catch (e) {
            // Silently ignore logo errors
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.text('LAPORAN GAMBARAN UMUM', pageWidth / 2, 35, { align: 'center' });
    doc.setFontSize(32);
    doc.text('SISTEM ' + (options.appSettings.app_name || 'PUAS').toUpperCase(), pageWidth / 2, 50, { align: 'center' });

    doc.setTextColor(47, 54, 64);
    doc.setFontSize(16);
    doc.text('Sistem Pengelolaan Keluhan & Aduan Masyarakat', pageWidth / 2, 100, { align: 'center' });

    doc.setFontSize(18);
    doc.text(options.appSettings.nama_sub_instansi || '', pageWidth / 2, 120, { align: 'center' });
    doc.text(options.appSettings.nama_instansi || '', pageWidth / 2, 128, { align: 'center' });

    // Decorative line
    doc.setDrawColor(47, 54, 64);
    doc.setLineWidth(1);
    doc.line(margin, 140, pageWidth - margin, 140);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const dateStr = new Date(options.printDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Dicetak pada: ${dateStr}`, pageWidth / 2, 150, { align: 'center' });

    // Bottom copyright - use app_footer_text if available
    doc.setFontSize(10);
    const footerCopyright = options.appSettings.app_footer_text || ('© 2024 ' + (options.appSettings.nama_sub_instansi || 'Tim Developer'));
    doc.text(footerCopyright, pageWidth / 2, pageHeight - 20, { align: 'center' });

    // --- PAGE 2: PENDAHULUAN & GAMBARAN UMUM ---
    doc.addPage();
    addPageNumber(2);

    let y = 25;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('1. Pendahuluan', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const introText = `Sistem ${options.appSettings.app_name || 'PUAS'} merupakan platform digital terintegrasi yang dirancang khusus untuk mengelola seluruh alur pengaduan, keluhan, dan aspirasi masyarakat/pengguna layanan di ${options.appSettings.nama_sub_instansi}. Sistem ini bertujuan untuk meningkatkan transparansi, kecepatan respon, dan efisiensi dalam penanganan masalah operasional maupun layanan publik.`;
    const introLines = doc.splitTextToSize(introText, pageWidth - (margin * 2));
    doc.text(introLines, margin, y);
    y += (introLines.length * 6) + 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('1.1 Visi & Misi Sistem', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const visionItems = [
        '- Mempercepat respon penanganan keluhan melalui notifikasi real-time.',
        '- Meningkatkan akuntabilitas petugas melalui pelacakan status tiket secara terbuka.',
        '- Menyediakan data analitik untuk pengambilan keputusan manajemen.',
        '- Mempermudah masyarakat dalam menyampaikan aduan dari mana saja.'
    ];
    visionItems.forEach(item => {
        doc.text(item, margin + 5, y);
        y += 6;
    });
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('1.2 Fitur Utama', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    const features = [
        ['Manajemen Tiket', 'Pencatatan aduan dengan kategori, unit tujuan, dan prioritas.'],
        ['Pelacakan Real-time', 'Pelapor dapat melihat status aduan menggunakan nomor tiket.'],
        ['SLA & Eskalasi', 'Kontrol batas waktu pengerjaan otomatis (Service Level Agreement).'],
        ['Analisis & Laporan', 'Dashboard statistik kepuasan dan performa unit kerja.'],
        ['Integrasi WhatsApp', 'Notifikasi dan kanal komunikasi langsung ke petugas.']
    ];

    autoTable(doc, {
        startY: y,
        head: [['Fitur', 'Deskripsi']],
        body: features,
        theme: 'grid',
        headStyles: { fillColor: [47, 54, 64] },
        styles: { fontSize: 10 },
        margin: { left: margin, right: margin }
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 15;

    // --- PAGE 3: STRUKTUR MENU & ANTARMUKA ---
    doc.addPage();
    addPageNumber(3);

    y = 25;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('2. Struktur Menu & Antarmuka', margin, y);
    y += 10;

    doc.setFontSize(14);
    doc.text('2.1 Menu Panel Admin', margin, y);
    y += 8;

    const adminMenus = [
        ['Dashboard', 'Ringkasan data tiket masuk, status, dan tren mingguan.'],
        ['Tiket Aduan', 'Pusat pengelolaan tiket (Verifikasi, Penugasan, Respon).'],
        ['Analisis Kepuasan', 'Grafik penilaian kepuasan dari pelapor setelah tiket selesai.'],
        ['Laporan & Ekspor', 'Generasi laporan periodik dalam format PDF/Excel.'],
        ['Manajemen Unit', 'Pengaturan unit kerja yang menangani aduan.'],
        ['Pengaturan Sistem', 'Konfigurasi identitas, SLA, dan format dokumen.']
    ];

    autoTable(doc, {
        startY: y,
        head: [['Menu Admin', 'Fungsi Utama']],
        body: adminMenus,
        theme: 'striped',
        headStyles: { fillColor: [52, 73, 94] },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin }
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('2.2 Alur Antarmuka Pengguna (User Flow)', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const flowText = 'Sistem dirancang dengan antarmuka modern dan responsif, dapat diakses melalui Desktop maupun Smartphone dengan nyaman.';
    doc.text(flowText, margin, y);
    y += 8;

    // Drawing a simple flow diagram using shapes
    const centerX = pageWidth / 2;
    const boxW = 40;
    const boxH = 12;

    const drawBox = (txt: string, x: number, yPos: number, fill: [number, number, number]) => {
        doc.setFillColor(...fill);
        doc.roundedRect(x - (boxW / 2), yPos, boxW, boxH, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(txt, x, yPos + 7.5, { align: 'center' });
    };

    drawBox('Input Aduan', centerX - 60, y, [41, 128, 185]);
    drawBox('Verifikasi', centerX, y, [41, 128, 185]);
    drawBox('Penanganan', centerX + 60, y, [41, 128, 185]);

    y += 20;
    doc.setTextColor(47, 54, 64);
    doc.text('Selesai / Rating', centerX, y + 7.5, { align: 'center' });
    doc.setDrawColor(47, 54, 64);
    doc.line(centerX - 10, y + 3, centerX + 10, y + 3);

    y += 15;

    // --- PAGE 4: PANDUAN PENGGUNA (MANUAL) ---
    doc.addPage();
    addPageNumber(4);

    y = 25;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('3. Panduan Penggunaan (User Manual)', margin, y);
    y += 10;

    doc.setFontSize(14);
    doc.text('3.1 Bagi Pelapor (Masyarakat)', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const manualUser = [
        '1. Akses halaman utama sistem.',
        '2. Klik tombol "Buat Aduan" atau pilih kategori layanan.',
        '3. Isi formulir identitas, lokasi, dan deskripsi keluhan secara lengkap.',
        '4. Unggah foto pendukung jika diperlukan untuk memperjelas aduan.',
        '5. Simpan Nomor Tiket yang muncul setelah aduan dikirim.',
        '6. Gunakan menu "Lacak Tiket" untuk memantau progres secara berkala.',
        '7. Berikan rating bintang 1-5 setelah aduan dinyatakan selesai.'
    ];
    manualUser.forEach(line => {
        doc.text(line, margin + 5, y);
        y += 6;
    });

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('3.2 Bagi Petugas/Admin', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const manualAdmin = [
        '1. Login menggunakan akun yang telah didaftarkan.',
        '2. Masuk ke menu "Tiket Aduan" untuk melihat daftar tiket baru.',
        '3. Klik "Detail" untuk memverifikasi keabsahan data aduan.',
        '4. Klik "Tanggapi/Update" untuk memberikan respon atau solusi.',
        '5. Pantau indikator SLA (Hijau/Kuning/Merah) untuk prioritas kerja.',
        '6. Ubah status menjadi "Selesai" jika permasalahan telah tuntas.',
        '7. Gunakan menu "Laporan" untuk mengunduh rekapitulasi performa bulanan.'
    ];
    manualAdmin.forEach(line => {
        doc.text(line, margin + 5, y);
        y += 6;
    });

    // --- FINAL PAGE: PENUTUP ---
    doc.addPage();
    addPageNumber(5);

    y = 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Penutup', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const closingText = `Demikian gambaran umum sistem ${options.appSettings.app_name || 'PUAS'} ini disusun. Sistem ini akan terus dikembangkan secara berkelanjutan untuk menyesuaikan kebutuhan pelayanan di ${options.appSettings.nama_sub_instansi}.`;
    const closingLines = doc.splitTextToSize(closingText, pageWidth - (margin * 4));
    doc.text(closingLines, pageWidth / 2, y, { align: 'center' });
    y += 30;

    doc.setFontSize(10);
    doc.text('Sistem Dikembangkan Oleh:', pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('TIM TEKNOLOGI INFORMASI', pageWidth / 2, y, { align: 'center' });

    doc.save(`Gambaran_Umum_Sistem_${options.appSettings.app_name || 'PUAS'}.pdf`);
};
