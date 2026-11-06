export interface PDFExportOptions {
    title: string;
    subtitle?: string;
    documentNumber?: string;
    filename: string;
    appSettings: {
        kop_nama: string;
        kop_rs: string;
        kop_alamat: string;
        kop_kontak: string;
        app_logo?: string;
        app_footer_text?: string;
    };
    printDate: string;
    signerName: string;
    signerRole: string;
    includeCoverPage?: boolean;
    narrativeIntro?: string[];
    kpiCards?: { title: string; value: string | number; subtitle?: string }[];
    chartSections?: {
        title: string;
        items: {
            label: string;
            value: number;
            max?: number;
            displayValue?: string;
            color?: [number, number, number];
        }[];
    }[];
    sections?: {
        sectionTitle: string;
        sectionNote?: string;
        headers: string[];
        data: any[][];
        columnWidths?: Record<number, number>;
    }[];
    tableHeaders?: string[];
    tableData?: any[][];
    additionalInfo?: string[];
    additionalInfoBottom?: string[];
    tableHeadersBottom?: string[];
    tableDataBottom?: any[][];
}

export const formatPrintDate = (dateInput: string): string => {
    if (!dateInput) return '';
    const cleanDate = dateInput.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const MONTHS = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
            return `${day} ${MONTHS[monthIdx]} ${year}`;
        }
    }
    return new Date(dateInput).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const generateFormalPDF = async (options: PDFExportOptions) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;

    // --- 1. COVER PAGE RESMI (JIKA includeCoverPage TRUE / DEFAULT TRUE UNTUK LAPORAN FORMAL) ---
    const shouldAddCover = options.includeCoverPage !== false;

    if (shouldAddCover) {
        // Background Header Navy
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 76, 'F');

        // Decorative Accent Line (Teal & Emerald dual-accent)
        doc.setFillColor(13, 148, 136); // teal
        doc.rect(0, 76, pageWidth, 2.5, 'F');
        doc.setFillColor(16, 185, 129); // emerald
        doc.rect(0, 78.5, pageWidth, 1, 'F');

        // Logo
        if (options.appSettings.app_logo && options.appSettings.app_logo.startsWith('data:image')) {
            try {
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(pageWidth / 2 - 13, 9, 26, 26, 4, 4, 'F');
                doc.addImage(options.appSettings.app_logo, 'PNG', pageWidth / 2 - 11, 11, 22, 22);
            } catch (e) { }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(options.appSettings.kop_nama.toUpperCase(), pageWidth / 2, 45, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(options.appSettings.kop_rs.toUpperCase(), pageWidth / 2, 53, { align: 'center' });

        doc.setFontSize(8.5);
        doc.setTextColor(203, 213, 225);
        doc.text('SISTEM INFORMASI & EVALUASI LAYANAN PUBLIK TERPADU (PUAS)', pageWidth / 2, 62, { align: 'center' });

        // Middle Title Section
        let cy = 104;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        const titleLines = doc.splitTextToSize(options.title.toUpperCase(), pageWidth - margin * 3);
        doc.text(titleLines, pageWidth / 2, cy, { align: 'center' });
        cy += (titleLines.length * 7.5) + 3;

        // Elegant Teal Accent Underline
        doc.setFillColor(13, 148, 136);
        doc.roundedRect(pageWidth / 2 - 18, cy, 36, 1.2, 0.6, 0.6, 'F');
        cy += 7;

        if (options.subtitle) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105);
            const subLines = doc.splitTextToSize(options.subtitle, pageWidth - margin * 3);
            doc.text(subLines, pageWidth / 2, cy, { align: 'center' });
            cy += (subLines.length * 5.5) + 14;
        } else {
            cy += 14;
        }

        // Formal Metadata Section (FRAMELESS MODERN EXECUTIVE ACCENT CARD)
        const metaW = 154;
        const metaH = 48;
        const metaX = (pageWidth - metaW) / 2;

        // Subtle soft background without outline/border
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(metaX, cy, metaW, metaH, 3, 3, 'F');

        // Elegant left vertical accent bar
        doc.setFillColor(13, 148, 136);
        doc.roundedRect(metaX, cy, 3.5, metaH, 1.5, 1.5, 'F');

        // Header inside metadata
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(13, 148, 136);
        doc.text('INFORMASI REGISTRASI DOKUMEN RESMI', metaX + 10, cy + 9);

        // Subtle separator hairline
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(metaX + 10, cy + 12, metaX + metaW - 8, cy + 12);

        // Key-Value Rows
        const colLabelX = metaX + 10;
        const colValX = metaX + 54;
        const docNum = options.documentNumber || `PUAS/LAP/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/001`;

        const metaRows = [
            { label: 'Nomor Dokumen', value: `:  ${docNum}` },
            { label: 'Tanggal Cetak', value: `:  ${formatPrintDate(options.printDate)}` },
            { label: 'Pejabat Pengesah', value: `:  ${options.signerName}` },
            { label: 'Jabatan', value: `:  ${options.signerRole}` }
        ];

        metaRows.forEach((row, rIdx) => {
            const rowY = cy + 19 + (rIdx * 7);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(row.label, colLabelX, rowY);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(row.value, colValX, rowY);
        });

        // Bottom Cover Footer
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Dokumen ini diterbitkan secara sah dan terekam dalam pangkalan data Sistem PUAS.', pageWidth / 2, pageHeight - 19, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        const footerInstansi = `${options.appSettings.kop_rs.toUpperCase()} • PORTAL EKSEKUTIF © ${new Date().getFullYear()}`;
        doc.text(footerInstansi, pageWidth / 2, pageHeight - 14, { align: 'center' });

        // Add page for content
        doc.addPage();
    }

    let yPos = margin;

    // --- 2. DRAW KOP SURAT FORMAL RESMI ---
    const drawKopSurat = () => {
        if (options.appSettings.app_logo && options.appSettings.app_logo.startsWith('data:image')) {
            try {
                doc.addImage(options.appSettings.app_logo, 'PNG', margin, yPos - 2, 16, 16);
            } catch (e) { }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(options.appSettings.kop_nama.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;

        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(options.appSettings.kop_rs.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(options.appSettings.kop_alamat, pageWidth / 2, yPos, { align: 'center' });
        yPos += 3.8;
        doc.text(options.appSettings.kop_kontak, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4.5;

        // Garis Ganda Pembatas Kop Resmi
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.7);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 0.8;
        doc.setLineWidth(0.2);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;
    };

    drawKopSurat();

    // --- 3. JUDUL & SUBJUDUL RESMI ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(options.title.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 4.5;

    if (options.subtitle) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(options.subtitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5.5;
    }

    // --- 4. KARTU RINGKASAN METRIK (KPI CARDS) ---
    if (options.kpiCards && options.kpiCards.length > 0) {
        const totalCards = options.kpiCards.length;
        const availableW = pageWidth - margin * 2;
        const cardGap = 3;
        const cardW = (availableW - (cardGap * (totalCards - 1))) / totalCards;
        const cardH = 15;

        options.kpiCards.forEach((kpi, idx) => {
            const cardX = margin + idx * (cardW + cardGap);
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.3);
            doc.roundedRect(cardX, yPos, cardW, cardH, 1.5, 1.5, 'FD');

            doc.setFillColor(13, 148, 136); // teal accent line
            doc.rect(cardX, yPos, cardW, 1.2, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text(kpi.title.toUpperCase(), cardX + cardW / 2, yPos + 4.5, { align: 'center' });

            doc.setFontSize(10.5);
            doc.setTextColor(15, 23, 42);
            doc.text(String(kpi.value), cardX + cardW / 2, yPos + 9.5, { align: 'center' });

            if (kpi.subtitle) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text(kpi.subtitle, cardX + cardW / 2, yPos + 13, { align: 'center' });
            }
        });

        yPos += cardH + 5;
    }

    // --- 5. NARASI PENGANTAR LAPORAN (BAHASA NATURAL, FORMAL, PROFESIONAL) ---
    const narrativeToUse = options.narrativeIntro || options.additionalInfo || [];
    if (narrativeToUse.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);

        narrativeToUse.forEach(line => {
            if (line === '') {
                yPos += 1.5;
            } else if (line.startsWith('I.') || line.startsWith('II.') || line.startsWith('III.') || line.startsWith('IV.') || line.startsWith('A.') || line.startsWith('B.') || line.startsWith('C.')) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(15, 23, 42);
                doc.text(line, margin, yPos);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(51, 65, 85);
                yPos += 4.5;
            } else {
                const lines = doc.splitTextToSize(line, pageWidth - margin * 2);
                doc.text(lines, margin, yPos);
                yPos += lines.length * 4;
            }
        });
        yPos += 3;
    }

    // --- 6. GRAFIK VEKTOR PROFESIONAL SESUAI DATA (CHART SECTIONS) ---
    if (options.chartSections && options.chartSections.length > 0) {
        options.chartSections.forEach(chart => {
            if (yPos > pageHeight - 50) {
                doc.addPage();
                yPos = margin + 10;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(chart.title, margin, yPos);
            yPos += 4;

            const chartW = pageWidth - margin * 2;
            const barHeight = 4.5;
            const barGap = 2.5;

            chart.items.forEach(item => {
                const maxVal = item.max || 100;
                const ratio = Math.min(Math.max(item.value / maxVal, 0), 1);
                const barMaxWidth = chartW - 65; // sisa untuk label dan angka

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(51, 65, 85);

                // Label nama
                const labelText = doc.splitTextToSize(item.label, 45)[0];
                doc.text(labelText, margin, yPos + 3.2);

                // Bar track (latar belakang abu)
                const barX = margin + 48;
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(barX, yPos, barMaxWidth, barHeight, 1, 1, 'F');

                // Bar fill
                const fillColor = item.color || [37, 99, 235];
                doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
                const fillW = Math.max(barMaxWidth * ratio, 2);
                doc.roundedRect(barX, yPos, fillW, barHeight, 1, 1, 'F');

                // Angka nilai
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(30, 41, 59);
                const display = item.displayValue || `${item.value}`;
                doc.text(display, barX + barMaxWidth + 3, yPos + 3.2);

                yPos += barHeight + barGap;
            });

            yPos += 4;
        });
    }

    // --- 7. TABEL DATA UTAMA ---
    if (options.tableHeaders && options.tableData) {
        autoTable(doc, {
            startY: yPos,
            head: [options.tableHeaders],
            body: options.tableData,
            theme: 'striped',
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: 2.2,
                textColor: [30, 41, 59],
            },
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.5,
                halign: 'center',
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            margin: { left: margin, right: margin },
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 6;
    }

    // --- 8. TABEL TAMBAHAN 2 (JIKA ADA) ---
    if (options.additionalInfoBottom && options.additionalInfoBottom.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        options.additionalInfoBottom.forEach(info => {
            if (info === '') {
                yPos += 1.5;
            } else if (info.startsWith('B.') || info.startsWith('2.') || info.startsWith('III.') || info.startsWith('IV.')) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(15, 23, 42);
                doc.text(info, margin, yPos);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(51, 65, 85);
                yPos += 4;
            } else {
                const lines = doc.splitTextToSize(info, pageWidth - margin * 2);
                doc.text(lines, margin, yPos);
                yPos += lines.length * 4;
            }
        });
        yPos += 2;
    }

    if (options.tableHeadersBottom && options.tableDataBottom) {
        autoTable(doc, {
            startY: yPos,
            head: [options.tableHeadersBottom],
            body: options.tableDataBottom,
            theme: 'striped',
            styles: {
                font: 'helvetica',
                fontSize: 7.2,
                cellPadding: 2,
                textColor: [30, 41, 59],
            },
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.2,
                halign: 'center',
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            margin: { left: margin, right: margin },
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 6;
    }

    // --- 9. MULTI SECTIONS ---
    if (options.sections && options.sections.length > 0) {
        options.sections.forEach(sec => {
            if (yPos > pageHeight - 45) {
                doc.addPage();
                yPos = margin + 10;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(sec.sectionTitle, margin, yPos);
            yPos += 3.5;

            if (sec.sectionNote) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.8);
                doc.setTextColor(100, 116, 139);
                doc.text(sec.sectionNote, margin, yPos);
                yPos += 3.5;
            }

            autoTable(doc, {
                startY: yPos,
                head: [sec.headers],
                body: sec.data,
                theme: 'striped',
                styles: {
                    font: 'helvetica',
                    fontSize: 7.2,
                    cellPadding: 2,
                    textColor: [30, 41, 59],
                },
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 7.2,
                    halign: 'center',
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252],
                },
                margin: { left: margin, right: margin },
            });

            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 6;
        });
    }

    // --- 10. LEMBAR PENGESAHAN RESMI ---
    if (yPos > pageHeight - 42) {
        doc.addPage();
        yPos = margin + 14;
    } else {
        yPos += 4;
    }

    const todayDate = formatPrintDate(options.printDate);
    const location = options.appSettings.kop_nama.replace('Pemerintah ', '').replace('Provinsi ', '').replace('Kabupaten ', '');
    const signatureText = `${location}, ${todayDate}`;

    const signBlockW = 65;
    const signBlockX = pageWidth - margin - signBlockW;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(signatureText, signBlockX + signBlockW / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.text('Mengetahui / Mengesahkan,', signBlockX + signBlockW / 2, yPos, { align: 'center' });
    yPos += 3.8;
    doc.setFont('helvetica', 'bold');
    doc.text(options.signerRole, signBlockX + signBlockW / 2, yPos, { align: 'center' });
    yPos += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(options.signerName, signBlockX + signBlockW / 2, yPos, { align: 'center' });
    const signerWidth = doc.getTextWidth(options.signerName);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(signBlockX + (signBlockW - signerWidth) / 2, yPos + 1, signBlockX + (signBlockW + signerWidth) / 2, yPos + 1);

    // --- 11. FOOTER & NOMOR HALAMAN DI SELURUH LEMBAR ---
    const totalPages = doc.getNumberOfPages();
    const startPageNumbering = shouldAddCover ? 2 : 1;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 && shouldAddCover) continue; // Cover page does not need header/footer

        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

        const footerTitle = `${options.appSettings.kop_rs} • Sistem PUAS Eksekutif`;
        doc.text(footerTitle, margin, pageHeight - 7.5);

        const pageText = `Halaman ${shouldAddCover ? p - 1 : p} dari ${shouldAddCover ? totalPages - 1 : totalPages}`;
        doc.text(pageText, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
    }

    doc.save(options.filename);
};

// --- DOKUMENTASI SISTEM & FLOWCHART STANDAR DIAGRAM ALIR LENGKAP (POIN 7) ---
export interface SystemOverviewOptions {
    appSettings: any;
    printDate: string;
}

export const generateSystemOverviewPDF = async (options: SystemOverviewOptions) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 16;

    const addFooter = (p: number, total: number) => {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        doc.text(`${options.appSettings.kop_rs || 'RSUD'} • Dokumentasi Arsitektur Sistem PUAS`, margin, pageHeight - 8);
        doc.text(`Halaman ${p} dari ${total}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    };

    // ==========================================
    // HALAMAN 1: COVER RESMI EKSKLUSIF
    // ==========================================
    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(0, 0, pageWidth, 95, 'F');
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(0, 95, pageWidth, 3.5, 'F');

    if (options.appSettings.app_logo && options.appSettings.app_logo.startsWith('data:image')) {
        try {
            doc.addImage(options.appSettings.app_logo, 'PNG', pageWidth / 2 - 14, 16, 28, 28);
        } catch (e) { }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text((options.appSettings.kop_nama || 'Pemerintah').toUpperCase(), pageWidth / 2, 53, { align: 'center' });

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text((options.appSettings.kop_rs || 'RUMAH SAKIT UMUM DAERAH').toUpperCase(), pageWidth / 2, 63, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setTextColor(203, 213, 225);
    doc.text('BUKU PANDUAN DAN DOKUMENTASI ARSITEKTUR TEKNIS SISTEM', pageWidth / 2, 73, { align: 'center' });

    let cy = 125;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text('DOKUMENTASI SISTEM PUAS', pageWidth / 2, cy, { align: 'center' });
    cy += 10;

    doc.setFontSize(13);
    doc.setTextColor(71, 85, 105);
    doc.text('Platform Pengelolaan Aduan, Kepuasan Masyarakat, & Layanan Terpadu', pageWidth / 2, cy, { align: 'center' });
    cy += 20;

    // Box Info Cover
    const boxW = 150;
    const boxH = 45;
    const boxX = (pageWidth - boxW) / 2;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(boxX, cy, boxW, boxH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('IDENTITAS SISTEM & VERSI DOKUMEN:', boxX + 8, cy + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Nama Platform : Sistem PUAS (Pusat Aduan & Survei)`, boxX + 8, cy + 18);
    doc.text(`Standar Regulasi: Permenpan RB No. 14 Tahun 2017 & UU No. 25/2009`, boxX + 8, cy + 25);
    doc.text(`Tanggal Cetak  : ${formatPrintDate(options.printDate)}`, boxX + 8, cy + 32);
    doc.text(`Penanggung Jawab: ${options.appSettings.nama_penandatangan || 'Direktur'}`, boxX + 8, cy + 39);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`PINTAR PUAS @2026. Mukhsin Hadi. All Right Reserved.`, pageWidth / 2, pageHeight - 16, { align: 'center' });

    // ==========================================
    // HALAMAN 2: BAB I & BAB II (ARSITEKTUR MENU)
    // ==========================================
    doc.addPage();
    let y = 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('BAB I. GAMBARAN UMUM & LANDASAN SISTEM', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const bab1Text = `Sistem PUAS merupakan solusi perangkat lunak terintegrasi yang dirancang khusus untuk memfasilitasi komunikasi dua arah antara masyarakat/pengguna layanan dengan seluruh unit kerja di ${options.appSettings.kop_rs || 'instansi'}. Sistem ini dibangun untuk memenuhi standar tata kelola pelayanan publik prima berdasarkan Undang-Undang No. 25 Tahun 2009 tentang Pelayanan Publik dan Peraturan Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi (Permenpan RB) No. 14 Tahun 2017.`;
    const b1Lines = doc.splitTextToSize(bab1Text, pageWidth - margin * 2);
    doc.text(b1Lines, margin, y);
    y += (b1Lines.length * 4.8) + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('BAB II. MODUL & STRUKTUR MENU APLIKASI', margin, y);
    y += 6;

    const moduleData = [
        ['1. Dasbor Utama (/admin)', 'Pusat pantauan metrik real-time: interaksi, tiket aktif, capaian SLA, dan aktivitas terbaru.'],
        ['2. Tiket & Laporan (/admin/tiket)', 'Manajemen siklus hidup tiket: verifikasi berkas, penugasan unit, respon, eskalasi, dan histori.'],
        ['3. Analisa Data (/admin/analisa)', 'Kecerdasan bisnis berupa tren bulanan, rasio proporsi kategori, dan visualisasi kinerja.'],
        ['4. Analisis Kepuasan (/admin/analisis-kepuasan)', 'Evaluasi 11 unsur IKM Permenpan RB, diagram speedometer capaian, dan peringkat kepuasan unit.'],
        ['5. Laporan Eksekutif (/admin/laporan)', 'Kompilasi rekapitulasi data periodik, filtering dinamis, dan ekspor formal PDF/Excel bertandatangan.'],
        ['6. Master Unit Kerja (/admin/unit)', 'Pengelolaan data satuan kerja pelayanan, PIC, impor batch via Excel/CSV, dan template upload.'],
        ['7. Master QR Code (/admin/qrcode)', 'Generator QR Code dinamis per unit kerja (Aduan, Survei, Informasi, Gabungan) dengan unit terkunci.'],
        ['8. Master Pengguna (/admin/pengguna)', 'Manajemen hak akses role (Superadmin, Admin Unit, Operator) dengan kontrol keamanan terenkripsi.'],
        ['9. Pengaturan Sistem (/admin/pengaturan)', 'Konfigurasi identitas kop surat, logo, nomor WhatsApp pengaduan, dan dokumentasi arsitektur.']
    ];

    autoTable(doc, {
        startY: y,
        head: [['Modul / Menu Sistem', 'Deskripsi Fungsionalitas & Cakupan Layanan']],
        body: moduleData,
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2 },
        headStyles: { fillColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin }
    });

    // ==========================================
    // HALAMAN 3: BAB III (FLOWCHART STANDAR DIAGRAM ALIR)
    // ==========================================
    doc.addPage();
    y = 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('BAB III. STANDAR DIAGRAM ALIR (FLOWCHART) PROSES BISNIS', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Diagram alir di bawah ini menggunakan simbol baku internasional (ANSI/ISO) untuk menjelaskan alur pengelolaan aduan dan survei:', margin, y);
    y += 12;

    // Helper Flowchart shapes
    const drawOval = (txt: string, x: number, yP: number, w: number, h: number, bg: [number, number, number]) => {
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.3);
        doc.roundedRect(x - w / 2, yP, w, h, h / 2, h / 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(txt, x, yP + h / 2 + 1, { align: 'center' });
    };

    const drawRect = (txt: string, x: number, yP: number, w: number, h: number, bg: [number, number, number], sub?: string) => {
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(x - w / 2, yP, w, h, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(txt, x, sub ? yP + h / 2 - 1.5 : yP + h / 2 + 1, { align: 'center' });
        if (sub) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text(sub, x, yP + h / 2 + 3, { align: 'center' });
        }
    };

    const drawDiamond = (txt: string, x: number, yP: number, size: number) => {
        const half = size / 2;
        doc.setFillColor(254, 243, 199); // Amber tint
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.4);
        // Draw diamond using lines
        doc.lines([
            [half, half],
            [-half, half],
            [-half, -half],
            [half, -half]
        ], x, yP, [1, 1], 'FD', true);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(146, 64, 14);
        doc.text(txt, x, yP + half + 1, { align: 'center' });
    };

    const drawArrow = (x1: number, y1: number, x2: number, y2: number, label?: string) => {
        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(0.4);
        doc.line(x1, y1, x2, y2);
        // Arrow head
        if (y2 > y1) {
            doc.line(x2, y2, x2 - 1.5, y2 - 2.5);
            doc.line(x2, y2, x2 + 1.5, y2 - 2.5);
        } else if (x2 > x1) {
            doc.line(x2, y2, x2 - 2.5, y2 - 1.5);
            doc.line(x2, y2, x2 - 2.5, y2 + 1.5);
        }
        if (label) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(37, 99, 235);
            doc.text(label, (x1 + x2) / 2 + 2, (y1 + y2) / 2);
        }
    };

    const cx = pageWidth / 2;

    // Step 1: Start
    drawOval('MULAI (Masyarakat / Pasien)', cx, y, 55, 9, [15, 23, 42]);
    drawArrow(cx, y + 9, cx, y + 17);
    y += 17;

    // Step 2: Input Aduan / Scan QR
    drawRect('1. Akses Kanal / Pindai QR Code Unit', cx, y, 70, 11, [248, 250, 252], 'Formulir Aduan, Survei IKM, atau Informasi');
    drawArrow(cx, y + 11, cx, y + 19);
    y += 19;

    // Step 3: Nomor Tiket & Notifikasi
    drawRect('2. Sistem Menerbitkan Nomor Tiket Realtime', cx, y, 70, 11, [240, 253, 244], 'Kirim Notifikasi ke Admin & WhatsApp');
    drawArrow(cx, y + 11, cx, y + 19);
    y += 19;

    // Step 4: Decision Verifikasi
    drawDiamond('Valid & Lengkap?', cx, y, 16);
    drawArrow(cx, y + 16, cx, y + 24, 'Ya');
    // Cabang Tidak
    doc.line(cx + 8, y + 8, cx + 55, y + 8);
    doc.line(cx + 55, y + 8, cx + 55, y + 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(220, 38, 38);
    doc.text('Tidak', cx + 18, y + 6);
    drawRect('Tiket Ditolak / Klarifikasi', cx + 55, y + 40, 40, 10, [254, 242, 242]);

    y += 24;

    // Step 5: Penanganan Unit
    drawRect('3. Disposisi & Penanganan Unit Kerja', cx, y, 70, 11, [239, 246, 255], 'Investigasi Lapangan & Perumusan Solusi');
    drawArrow(cx, y + 11, cx, y + 19);
    y += 19;

    // Step 6: Decision Butuh Eskalasi?
    drawDiamond('Butuh Eskalasi?', cx, y, 16);
    drawArrow(cx, y + 16, cx, y + 24, 'Tuntas');
    // Cabang Eskalasi
    doc.line(cx - 8, y + 8, cx - 55, y + 8);
    doc.line(cx - 55, y + 8, cx - 55, y + 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(234, 88, 12);
    doc.text('Eskalasi', cx - 25, y + 6);
    drawRect('Eskalasi ke Manajemen / Direksi', cx - 55, y + 40, 42, 10, [255, 247, 237]);

    y += 24;

    // Step 7: Penutupan & Rating CSAT
    drawRect('4. Tiket Selesai & Umpan Balik Kepuasan', cx, y, 70, 11, [240, 253, 244], 'Pelapor Mengisi Rating CSAT / IKM');
    drawArrow(cx, y + 11, cx, y + 19);
    y += 19;

    // Step 8: Selesai
    drawOval('SELESAI (Arsip Laporan Digital)', cx, y, 55, 9, [13, 148, 136]);

    // ==========================================
    // HALAMAN 4: BAB IV (METODOLOGI IKM PERMENPAN RB) & PENGESAHAN
    // ==========================================
    doc.addPage();
    y = 24;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('BAB IV. FORMULASI PENGUKURAN INDEKS KEPUASAN MASYARAKAT (IKM)', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const ikmExplain = `Berdasarkan Permenpan RB No. 14 Tahun 2017, evaluasi kepuasan diukur melalui 11 unsur pelayanan publik dengan bobot berimbang:`;
    doc.text(ikmExplain, margin, y);
    y += 6;

    const ikmTable = [
        ['U1', 'Persyaratan Pelayanan', 'Kesesuaian berkas dengan standar'],
        ['U2', 'Kemudahan Prosedur', 'Alur birokrasi yang ringkas'],
        ['U3', 'Kecepatan Waktu', 'Ketepatan durasi penyelesaian'],
        ['U4', 'Kewajaran Biaya / Tarif', 'Transparansi retribusi resmi'],
        ['U5', 'Kesesuaian Produk', 'Kualitas output pelayanan'],
        ['U6', 'Kompetensi Petugas', 'Kecakapan dan keahlian SDM'],
        ['U7', 'Perilaku & Kesopanan', 'Keramahan dan etika petugas'],
        ['U8', 'Sarana & Prasarana', 'Kenyamanan fasilitas pelayanan'],
        ['U9', 'Penanganan Pengaduan', 'Kecepatan tindak lanjut keluhan'],
        ['U10', 'Transparansi Layanan', 'Kemudahan akses informasi publik'],
        ['U11', 'Integritas Petugas', 'Bebas pungli dan gratifikasi']
    ];

    autoTable(doc, {
        startY: y,
        head: [['Kode', 'Unsur Indikator Layanan', 'Fokus Pengukuran']],
        body: ikmTable,
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [15, 23, 42], fontStyle: 'bold' },
        margin: { left: margin, right: margin }
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 8;

    // Formula Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('RUMUS MATEMATIS KONVERSI IKM:', margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('Indeks IKM (Skala 1 - 4) = Total Skor Seluruh Pertanyaan / Total Pertanyaan Terjawab', margin + 4, y + 11);
    doc.text('Nilai Konversi IKM (Skala 25 - 100) = Indeks IKM * 25 | Mutu A (>=88.31), B (76.61-88.30), C (65-76.60), D (<65)', margin + 4, y + 16);
    y += 28;

    // Signature Block
    const signDate = formatPrintDate(options.printDate);
    const signLoc = (options.appSettings.kop_nama || '').replace('Pemerintah ', '').replace('Provinsi ', '').replace('Kabupaten ', '');
    const signX = pageWidth - margin - 65;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${signLoc}, ${signDate}`, signX + 32, y, { align: 'center' });
    y += 4;
    doc.text('Mengesahkan Dokumen Teknis,', signX + 32, y, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(options.appSettings.jabatan_penandatangan || 'Direktur', signX + 32, y, { align: 'center' });
    y += 18;

    doc.text(options.appSettings.nama_penandatangan || 'Dr. Mulyadi Saputra, MARS', signX + 32, y, { align: 'center' });
    const sWidth = doc.getTextWidth(options.appSettings.nama_penandatangan || 'Dr. Mulyadi Saputra, MARS');
    doc.line(signX + 32 - sWidth / 2, y + 1, signX + 32 + sWidth / 2, y + 1);

    // Number all pages
    const totalP = doc.getNumberOfPages();
    for (let p = 2; p <= totalP; p++) {
        addFooter(p, totalP);
    }

    doc.save(`Dokumentasi_Arsitektur_Sistem_${options.appSettings.app_name || 'PUAS'}.pdf`);
};
