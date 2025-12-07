
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuditSession, HistoryEntry, InventoryItem, ScheduledAudit } from '../types';

const STORAGE_KEY = 'audit_history';
const SCHEDULE_KEY = 'audit_schedules';
const LOGO_URL = "https://i.ibb.co/hFq3BtD9/Movilnet-logo-0.png";

// Helper to handle case-insensitive and accent-insensitive key lookup
const normalizeKey = (key: string) => key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const findValueInRow = (row: any, possibleKeys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const targetKey of possibleKeys) {
        const foundKey = rowKeys.find(k => normalizeKey(k) === normalizeKey(targetKey));
        if (foundKey) return row[foundKey];
    }
    return undefined;
};

export const AuditService = {
  // --- Excel Processing ---
  parseExcel: async (file: File): Promise<InventoryItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);

          const items: InventoryItem[] = jsonData.map((row: any) => {
            // Robust key mapping to handle accents and case variations
            const sku = String(findValueInRow(row, ['sku', 'codigo', 'code', 'barcode', 'id', 'item']) || 'UNKNOWN');
            const desc = String(findValueInRow(row, ['descripcion', 'description', 'nombre', 'producto', 'name', 'desc', 'detalle']) || 'Sin descripción');
            const qty = Number(findValueInRow(row, ['cantidad', 'qty', 'teorico', 'theoretical', 'stock', 'existencia', 'cant']) || 0);

            return {
                id: sku === 'UNKNOWN' ? Math.random().toString(36).substr(2, 9) : sku,
                sku: sku,
                description: desc,
                theoreticalQty: qty,
                physicalQty: 0,
            };
          }).filter(item => item.sku !== 'UNKNOWN');

          resolve(items);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  },

  // --- PDF Generation ---
  generatePDF: (session: AuditSession) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Corporate Colors (Dark Slate & Red Accent)
    const colorPrimary = [220, 38, 38]; // Red
    const colorSecondary = [30, 41, 59]; // Dark Slate Blue
    const colorLightGray = [241, 245, 249]; // Light Gray

    // --- Header ---
    // Logo
    const imgProps = doc.getImageProperties(LOGO_URL);
    const imgWidth = 45;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    doc.addImage(LOGO_URL, 'PNG', 14, 10, imgWidth, imgHeight);

    // Title & Info Box
    doc.setFillColor(colorLightGray[0], colorLightGray[1], colorLightGray[2]);
    doc.roundedRect(120, 10, 76, 26, 2, 2, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(colorSecondary[0], colorSecondary[1], colorSecondary[2]);
    doc.text("INFORME DE AUDITORÍA", 158, 17, { align: 'center' });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`ID: ${session.id.toUpperCase().substring(0, 8)}`, 125, 23);
    doc.text(`Fecha: ${new Date(session.date).toLocaleDateString()}`, 125, 28);
    doc.text(`Hora: ${new Date(session.date).toLocaleTimeString()}`, 125, 33);

    // --- Context Info ---
    const startYInfo = imgHeight + 18;
    
    doc.setFontSize(16);
    doc.setTextColor(colorSecondary[0], colorSecondary[1], colorSecondary[2]);
    doc.setFont("helvetica", "bold");
    doc.text(session.storeName, 14, startYInfo);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Responsable:`, 14, startYInfo + 6);
    doc.setTextColor(0);
    doc.text(session.auditorName, 40, startYInfo + 6);

    // --- Metrics Summary ---
    const discrepancies = session.items.filter(i => i.theoreticalQty !== i.physicalQty);
    const totalItems = session.items.length;
    const totalDiscrepancies = discrepancies.length;
    const accuracy = ((1 - (totalDiscrepancies / totalItems)) * 100).toFixed(1);
    const totalPhysical = session.items.reduce((a,b) => a + b.physicalQty, 0);

    const startYMetrics = startYInfo + 15;
    
    // Draw metrics stats
    const drawMetric = (label: string, value: string, x: number, color: number[] = [0,0,0]) => {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(label.toUpperCase(), x, startYMetrics);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, x, startYMetrics + 6);
    };

    drawMetric("Total Items", String(totalItems), 14);
    drawMetric("Conteo Total", String(totalPhysical), 50);
    drawMetric("Incidencias", String(totalDiscrepancies), 90, totalDiscrepancies > 0 ? [220, 38, 38] : [22, 163, 74]);
    drawMetric("Precisión", `${accuracy}%`, 130, Number(accuracy) > 95 ? [22, 163, 74] : [220, 38, 38]);

    // Observations Section
    let tableStartY = startYMetrics + 15;
    if (session.observations) {
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text("Observaciones:", 14, tableStartY);
        
        doc.setFont("helvetica", "italic");
        doc.setTextColor(50);
        const splitObs = doc.splitTextToSize(session.observations, 180);
        doc.text(splitObs, 40, tableStartY);
        tableStartY += (splitObs.length * 4) + 5;
    }

    // --- Table ---
    const tableData = session.items.map(item => [
      item.sku,
      item.description,
      item.theoreticalQty,
      item.physicalQty,
      item.physicalQty - item.theoreticalQty
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: [['SKU', 'DESCRIPCIÓN', 'TEÓRICO', 'FÍSICO', 'DIFERENCIA']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [50, 50, 50],
        lineColor: [230, 230, 230],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: colorSecondary as [number, number, number],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 35 }, // SKU
        1: { cellWidth: 'auto' }, // Desc
        2: { halign: 'center', cellWidth: 25 }, // Teo
        3: { halign: 'center', cellWidth: 25 }, // Fisico
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 25 }  // Diff
      },
      didParseCell: (data) => {
        // Highlight difference column
        if (data.section === 'body' && data.column.index === 4) {
          const val = Number(data.cell.raw);
          if (val < 0) data.cell.styles.textColor = [220, 38, 38]; // Red
          if (val > 0) {
            data.cell.styles.textColor = [22, 163, 74]; // Green
            data.cell.text = `+${val}`; // Add plus sign
          }
        }
      }
    });

    // --- Footer ---
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
        doc.text(`Generado con AuditPro - ${new Date().toLocaleString()}`, 14, pageHeight - 10);
    }

    const safeFilename = session.storeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Auditoria_${safeFilename}_${new Date().toISOString().split('T')[0]}.pdf`);
  },

  // --- History Management ---
  saveToHistory: (session: AuditSession) => {
    const history = AuditService.getHistory();
    const discrepancies = session.items.filter(i => i.theoreticalQty !== i.physicalQty).length;
    
    const entry: HistoryEntry = {
      id: session.id,
      storeName: session.storeName,
      date: session.date,
      auditorName: session.auditorName,
      totalItems: session.items.length,
      totalDiscrepancies: discrepancies
    };

    const newHistory = [entry, ...history].slice(0, 5); // Keep last 5
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  },

  getHistory: (): HistoryEntry[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  // --- Schedule Management ---
  getScheduledAudits: (): ScheduledAudit[] => {
    const stored = localStorage.getItem(SCHEDULE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  addScheduledAudit: (audit: ScheduledAudit) => {
    const audits = AuditService.getScheduledAudits();
    const newAudits = [...audits, audit];
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(newAudits));
  },

  completeScheduledAudit: (storeName: string, username: string) => {
    const audits = AuditService.getScheduledAudits();
    const updatedAudits = audits.map(a => {
      if (a.status === 'PENDING' && 
          a.storeName.toLowerCase() === storeName.toLowerCase() && 
          a.assignedToUsername === username) {
        return { ...a, status: 'COMPLETED' as const };
      }
      return a;
    });
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(updatedAudits));
  }
};
