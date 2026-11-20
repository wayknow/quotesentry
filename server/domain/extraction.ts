import { llmExtractionSchema, type EngineMode, type LlmLine, type SourceType } from '../../shared/schema.js';
import { callDeepSeekJson, hasLlmKey } from '../llm/client.js';
import { config } from '../config.js';
import { normalizeMaterial, normalizeProductType, normalizeStrength, normalizeSurface, normalizeUnit } from './normalization.js';
import { normalizeStandard } from './standards.js';
import { normalizeWhitespace } from '../utils.js';

export interface ExtractedLine {
  lineIndex: number;
  sourceLine: string;
  evidenceLocation: string;
  evidenceVerified: boolean;
  productType: string | null;
  standard: string | null;
  diameterMm: number | null;
  lengthMm: number | null;
  threadPitchMm: number | null;
  material: string | null;
  strengthGrade: string | null;
  surfaceTreatment: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface ExtractionResult {
  lines: ExtractedLine[];
  engineMode: EngineMode;
  engineNote: string;
  model: string | null;
}

const CANDIDATE_HINTS = /(m\d+(?:\.\d+)?\s*[x×]\s*\d+|bolt|screw|nut|washer|same as last time|repeat order)/i;
const IGNORE_HINTS = /^(subject|from|to|dear|hi|hello|please confirm|best regards|regards|thanks|thank you|one box|each box|one carton|each carton|packing)\b/i;

export async function extractLines(rawText: string, sourceType: SourceType): Promise<ExtractionResult> {
  if (sourceType === 'csv' || sourceType === 'xlsx') {
    return {
      lines: extractCsvLines(rawText),
      engineMode: 'rules',
      engineNote: '结构化表格输入：使用确定性表头映射，不调用 LLM。',
      model: null,
    };
  }

  if (hasLlmKey()) {
    try {
      const llm = await llmExtract(rawText);
      return {
        lines: llm,
        engineMode: 'llm',
        engineNote: 'DeepSeek 实时抽取；模型只返回字段和原文片段，不返回价格。',
        model: config.llm.model,
      };
    } catch (error) {
      return {
        lines: extractTextLines(rawText),
        engineMode: 'rules',
        engineNote: `DeepSeek 调用失败，已降级为规则模式：${(error as Error).message}`,
        model: null,
      };
    }
  }

  return {
    lines: extractTextLines(rawText),
    engineMode: 'rules',
    engineNote: '未配置 DEEPSEEK_API_KEY：使用规则模式。界面明确标注，不冒充 AI。',
    model: null,
  };
}

export function extractTextLines(rawText: string): ExtractedLine[] {
  const textLines = rawText.split(/\r?\n/);
  const lines: ExtractedLine[] = [];
  textLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || IGNORE_HINTS.test(trimmed) || !CANDIDATE_HINTS.test(trimmed)) return;
    const extracted = ruleExtractLine(trimmed, index + 1, `line ${index + 1}`);
    lines.push(extracted);
  });
  return lines.map((line, index) => ({ ...line, lineIndex: index + 1 }));
}

export function extractCsvLines(rawText: string): ExtractedLine[] {
  const rows = parseCsvRows(rawText).filter((cells) => cells.some((cell) => cell.trim()));
  if (rows.length < 2) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const get = (cells: string[], name: string): string | null => {
    const i = index(name);
    return i >= 0 && cells[i] ? cells[i].trim() : null;
  };
  const hasHeader = index('product_type') >= 0 || index('standard') >= 0 || index('diameter_mm') >= 0;
  if (!hasHeader) return extractTextLines(rawText);

  return rows.slice(1).flatMap((row, rowIndex) => {
    const cells = row.map((cell) => cell.trim());
    if (cells[0]?.startsWith('#')) return [];
    const sourceLine = cells.join(' | ');
    return [{
      ...ruleExtractLine(sourceLine, rowIndex + 2, `row ${rowIndex + 2}`),
      lineIndex: rowIndex + 1,
      sourceLine,
      evidenceLocation: `row ${rowIndex + 2}`,
      evidenceVerified: true,
      productType: normalizeProductType(get(cells, 'product_type')),
      standard: normalizeStandard(get(cells, 'standard')),
      diameterMm: numberOrNull(get(cells, 'diameter_mm')),
      lengthMm: numberOrNull(get(cells, 'length_mm')),
      threadPitchMm: numberOrNull(get(cells, 'thread_pitch_mm')),
      material: normalizeMaterial(get(cells, 'material')),
      strengthGrade: normalizeStrength(get(cells, 'strength_grade')),
      surfaceTreatment: normalizeSurface(get(cells, 'surface_treatment')),
      quantity: numberOrNull(get(cells, 'quantity')),
      unit: normalizeUnit(get(cells, 'unit')),
    }];
  });
}

function parseCsvRows(rawText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = rawText.replace(/^\uFEFF/, '');

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

export function ruleExtractLine(line: string, lineIndex: number, location: string): ExtractedLine {
  const standardMatch = line.match(/\b(DIN\s*933|DIN\s*931|ISO\s*4017|ISO\s*4014|GB\s*\/?\s*T\s*578[23])\b/i);
  const dimension = line.match(/\bM(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\b/);
  const pitch = line.match(/\bP\s*(\d+(?:\.\d+)?)\b/i);
  const quantity = line.match(/([\d,]+(?:\.\d+)?)\s*(pcs|pieces|units|boxes|sets|kg)\b/i);
  const materialText = line.match(/\b(carbon steel|stainless steel|ss\s*304|ss\s*316|a2|a4)\b/i)?.[1] ?? null;
  const strengthText = line.match(/\b(8\.8|10\.9|12\.9|A2-70|A4-80)\b/i)?.[1] ?? null;
  const surfaceText = line.match(/\b(zinc plated|zinc|zn|hot[- ]?dip galvanized|hot[- ]?dip|hdg|plain|black)\b/i)?.[1] ?? null;
  const productText = line.match(/\b(hex bolt|bolt|screw|nut|washer)\b/i)?.[1] ?? null;

  return {
    lineIndex,
    sourceLine: line,
    evidenceLocation: location,
    evidenceVerified: true,
    productType: normalizeProductType(productText),
    standard: normalizeStandard(standardMatch?.[1] ?? null),
    diameterMm: dimension ? Number(dimension[1]) : null,
    lengthMm: dimension ? Number(dimension[2]) : null,
    threadPitchMm: pitch ? Number(pitch[1]) : null,
    material: normalizeMaterial(materialText),
    strengthGrade: normalizeStrength(strengthText),
    surfaceTreatment: normalizeSurface(surfaceText),
    quantity: quantity ? Number(quantity[1].replace(/,/g, '')) : null,
    unit: normalizeUnit(quantity?.[2] ?? null),
  };
}

async function llmExtract(rawText: string): Promise<ExtractedLine[]> {
  const prompt = `You extract fastener RFQ lines for QuoteSentry. Return ONLY JSON.

For every product line in the inquiry, return:
{
  "lines": [
    {
      "lineIndex": 1,
      "sourceLine": "an EXACT substring copied from the inquiry that contains this product line",
      "productType": "hex_bolt | screw | hex_nut | washer | null",
      "standard": "DIN 933 | DIN 931 | ISO 4017 | ISO 4014 | GB/T 5783 | GB/T 5782 | null",
      "diameterMm": number | null,
      "lengthMm": number | null,
      "threadPitchMm": number | null,
      "material": "carbon_steel | SS304 | SS316 | null",
      "strengthGrade": "8.8 | 10.9 | 12.9 | A2-70 | A4-80 | null",
      "surfaceTreatment": "zinc | hdg | plain | null",
      "quantity": number | null,
      "unit": "pcs | boxes | sets | kg | null"
    }
  ]
}

Rules:
- Extract each product line separately, even if multiple lines are in one email.
- Never invent a price, SKU, material, standard, finish, or quantity.
- If the customer says "same as last time" and no specification is present, return the line with all unknown fields null.
- sourceLine must be copied verbatim from the inquiry. Do not paraphrase it.

Inquiry:
<<<
${rawText}
>>>`;

  const parsed = llmExtractionSchema.parse(await callDeepSeekJson(prompt));
  return parsed.lines.map((line, index) => normalizeLlmLine(line, index + 1, rawText));
}

function normalizeLlmLine(line: LlmLine, fallbackIndex: number, rawText: string): ExtractedLine {
  const sourceLine = line.sourceLine?.trim() || '';
  const verified = Boolean(sourceLine) && normalizeWhitespace(rawText).includes(normalizeWhitespace(sourceLine));
  return {
    lineIndex: line.lineIndex || fallbackIndex,
    sourceLine,
    evidenceLocation: verified ? `text: ${sourceLine.slice(0, 80)}` : '未验证',
    evidenceVerified: verified,
    productType: normalizeProductType(line.productType),
    standard: normalizeStandard(line.standard),
    diameterMm: line.diameterMm,
    lengthMm: line.lengthMm,
    threadPitchMm: line.threadPitchMm,
    material: normalizeMaterial(line.material),
    strengthGrade: normalizeStrength(line.strengthGrade),
    surfaceTreatment: normalizeSurface(line.surfaceTreatment),
    quantity: line.quantity,
    unit: normalizeUnit(line.unit),
  };
}

function numberOrNull(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
