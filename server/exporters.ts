import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { CustomerExportData } from './domain/workflow.js';

export function customerQuoteCsv(data: CustomerExportData): string {
  const rows: Array<Array<string | number>> = [
    ['Quote', data.quoteId],
    ['Customer', data.customerName],
    ['Incoterm', data.incoterm],
    ['Currency', data.currency],
    ['Valid until', data.validUntil],
    [],
    ['SKU', 'Description', 'Quantity', 'Unit', 'Unit price (USD)', 'Amount (USD)'],
    ...data.lines.map((line) => [
      line.sku,
      line.description,
      line.quantity,
      line.unit,
      line.unitPriceUsd.toFixed(2),
      line.amountUsd.toFixed(2),
    ]),
    [],
    ['Total', '', '', '', '', data.totalUsd.toFixed(2)],
    [],
    ['Demo data only. Not a binding offer.'],
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export async function customerQuotePdf(data: CustomerExportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 48;
  let page = doc.addPage(pageSize);
  let y = 790;

  const text = (
    value: string,
    x: number,
    options?: { size?: number; bold?: boolean; color?: 'muted' | 'normal' },
  ) => {
    page.drawText(safeText(value), {
      x,
      y,
      size: options?.size ?? 10,
      font: options?.bold ? bold : font,
      color: options?.color === 'muted' ? rgb(0.42, 0.47, 0.55) : rgb(0.08, 0.12, 0.18),
    });
  };

  page.drawRectangle({ x: 0, y: 792, width: pageSize[0], height: 50, color: rgb(0.06, 0.12, 0.2) });
  page.drawText('QuoteSentry', { x: margin, y: 812, size: 17, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Fastener quotation', { x: 388, y: 814, size: 9, font, color: rgb(0.74, 0.82, 0.92) });

  y = 750;
  text('QUOTATION', margin, { size: 18, bold: true });
  y -= 17;
  text(`Quote ${data.quoteId}`, margin, { size: 9, color: 'muted' });
  y -= 30;
  text('Customer', margin, { size: 8, color: 'muted', bold: true });
  y -= 12;
  text(data.customerName, margin, { size: 11, bold: true });
  y -= 18;
  text('Incoterm', margin, { size: 8, color: 'muted', bold: true });
  y -= 12;
  text(data.incoterm, margin, { size: 10 });
  y -= 16;
  text('Valid until', margin, { size: 8, color: 'muted', bold: true });
  y -= 12;
  text(data.validUntil, margin, { size: 10 });

  y -= 38;
  page.drawRectangle({ x: margin, y: y - 5, width: pageSize[0] - margin * 2, height: 22, color: rgb(0.94, 0.96, 0.98) });
  text('SKU', margin + 8, { size: 9, bold: true, color: 'muted' });
  text('Description', 150, { size: 9, bold: true, color: 'muted' });
  text('Qty', 385, { size: 9, bold: true, color: 'muted' });
  text('Unit', 424, { size: 9, bold: true, color: 'muted' });
  text('USD/unit', 470, { size: 9, bold: true, color: 'muted' });
  text('Amount', 522, { size: 9, bold: true, color: 'muted' });
  y -= 25;

  for (const line of data.lines) {
    if (y < 120) {
      page = doc.addPage(pageSize);
      y = 790;
    }
    text(line.sku, margin + 8, { size: 8.5 });
    text(line.description.slice(0, 42), 150, { size: 8.5 });
    text(`${line.quantity.toLocaleString('en-US')} ${line.unit}`, 385, { size: 8.5 });
    text(line.unitPriceUsd.toFixed(2), 470, { size: 8.5 });
    text(line.amountUsd.toFixed(2), 522, { size: 8.5 });
    y -= 20;
    page.drawLine({ start: { x: margin, y: y + 7 }, end: { x: pageSize[0] - margin, y: y + 7 }, thickness: 0.3, color: rgb(0.86, 0.89, 0.93) });
  }

  y -= 8;
  text('TOTAL', 420, { size: 9, bold: true, color: 'muted' });
  text(`${data.currency} ${data.totalUsd.toFixed(2)}`, 500, { size: 12, bold: true });

  y -= 48;
  text('Commercial notes', margin, { size: 9, bold: true });
  y -= 15;
  text('Prices are ex-works plus the stated Incoterm. Taxes and bank charges are excluded.', margin, { size: 8, color: 'muted' });
  y -= 12;
  text('Demo data only. This document is not a binding offer.', margin, { size: 8, color: 'muted' });

  return doc.save();
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?');
}
