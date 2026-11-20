import fs from 'node:fs';
import path from 'node:path';
import type { Customer, RfqDocument } from '../../shared/schema.js';
import { dataCache } from '../../server/data.js';
import { applyExtraction } from '../../server/domain/analyze.js';
import { extractCsvLines, extractTextLines, type ExtractedLine, type ExtractionResult } from '../../server/domain/extraction.js';
import { hashText } from '../../server/utils.js';

export function sampleText(file: string): string {
  return dataCache.samples.find((sample) => sample.file === file)
    ? readSample(file)
    : '';
}

function readSample(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'data', 'samples', file), 'utf8');
}

export function customer(id: string): Customer {
  const found = dataCache.customers.find((item) => item.id === id);
  if (!found) throw new Error(`Missing customer ${id}`);
  return found;
}

export function emptyDocument(customerId: string, rawText: string, sourceType: RfqDocument['sourceType'] = 'text'): RfqDocument {
  return {
    id: 'test-rfq',
    title: 'Test RFQ',
    sourceType,
    customerId,
    rawText,
    inputHash: hashText(rawText),
    status: 'RECEIVED',
    engineMode: 'rules',
    engineNote: null,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    lines: [],
    quotes: [],
    currentQuoteId: null,
    audit: [],
  };
}

export function analyzeText(file: string, customerId: string): RfqDocument {
  const rawText = sampleText(file);
  const extraction: ExtractionResult = {
    lines: extractTextLines(rawText),
    engineMode: 'rules',
    engineNote: 'test rules',
    model: null,
  };
  return applyExtraction(emptyDocument(customerId, rawText), extraction, {
    customer: customer(customerId),
    catalog: dataCache.catalog,
    rules: dataCache.pricingRules,
  });
}

export function analyzeCsv(file: string, customerId: string): RfqDocument {
  const rawText = sampleText(file);
  const extraction: ExtractionResult = {
    lines: extractCsvLines(rawText),
    engineMode: 'rules',
    engineNote: 'test csv',
    model: null,
  };
  return applyExtraction(emptyDocument(customerId, rawText, 'csv'), extraction, {
    customer: customer(customerId),
    catalog: dataCache.catalog,
    rules: dataCache.pricingRules,
  });
}

export function fullLine(overrides: Partial<ExtractedLine> = {}): ExtractedLine {
  return {
    lineIndex: 1,
    sourceLine: '200 pcs M12x75 hex bolt DIN 933 grade 8.8 carbon steel zinc plated',
    evidenceLocation: 'line 1',
    evidenceVerified: true,
    productType: 'hex_bolt',
    standard: 'DIN 933',
    diameterMm: 12,
    lengthMm: 75,
    threadPitchMm: null,
    material: 'carbon_steel',
    strengthGrade: '8.8',
    surfaceTreatment: 'zinc',
    quantity: 200,
    unit: 'pcs',
    ...overrides,
  };
}
