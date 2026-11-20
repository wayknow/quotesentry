import { describe, expect, it } from 'vitest';
import { dataCache } from '../../server/data.js';
import { extractCsvLines, extractTextLines, ruleExtractLine } from '../../server/domain/extraction.js';
import { evaluateGate } from '../../server/domain/gate.js';
import { matchCatalog } from '../../server/domain/matcher.js';
import { standardGroup } from '../../server/domain/standards.js';
import { sampleText, fullLine } from './helpers.js';

describe('completeness gate', () => {
  it('passes a fully specified line', () => {
    expect(evaluateGate(fullLine()).ready).toBe(true);
  });

  it('blocks a line with no surface treatment', () => {
    const result = evaluateGate(fullLine({ surfaceTreatment: null }));
    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain('surfaceTreatment');
  });

  it('blocks unsupported units instead of converting boxes to pieces', () => {
    const line = ruleExtractLine('100 boxes M10x50 hex bolt DIN 933 grade 8.8 carbon steel zinc plated', 1, 'line 1');
    const result = evaluateGate(line);
    expect(result.ready).toBe(false);
    expect(result.conflicts.join(' ')).toContain('不能直接计价');
  });

  it('blocks unverified model evidence', () => {
    const result = evaluateGate(fullLine({ evidenceVerified: false }));
    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain('evidence');
  });

  it('does not create a phantom line from a packing note', () => {
    const lines = extractTextLines(sampleText('04-unit-conflict.txt'));
    expect(lines).toHaveLength(1);
    expect(lines[0].unit).toBe('boxes');
  });
});

describe('catalog hard matching', () => {
  it('treats DIN 931, ISO 4014 and GB/T 5782 as one partial-thread group', () => {
    expect(standardGroup('DIN 931')).toBe('partial_thread');
    expect(standardGroup('ISO 4014')).toBe('partial_thread');
    expect(standardGroup('GB/T 5782')).toBe('partial_thread');
    const match = matchCatalog(fullLine({ standard: 'DIN 931', diameterMm: 10, lengthMm: 60 }), dataCache.catalog);
    expect(match.sku?.sku).toBe('HB-M10X60-88-ZN-PT');
  });

  it('returns no match for an out-of-catalog M14 bolt', () => {
    const match = matchCatalog(fullLine({ diameterMm: 14, lengthMm: 60 }), dataCache.catalog);
    expect(match.sku).toBeNull();
    expect(match.reason).toContain('不会用相似规格替代');
  });

  it('does not substitute material, grade or finish', () => {
    const match = matchCatalog(fullLine({ surfaceTreatment: 'hdg' }), dataCache.catalog);
    expect(match.sku?.surfaceTreatment).toBe('hdg');
    expect(match.sku?.sku).toBe('HB-M12X75-88-HDG');

    const wrongGrade = matchCatalog(fullLine({ strengthGrade: '10.9' }), dataCache.catalog);
    expect(wrongGrade.sku?.strengthGrade).toBe('10.9');
    expect(wrongGrade.sku?.sku).toBe('HB-M12X75-109-ZN');
  });
});

describe('structured table extraction', () => {
  it('handles quoted commas without shifting columns', () => {
    const csv = [
      'product_type,standard,diameter_mm,length_mm,material,strength_grade,surface_treatment,quantity,unit,description',
      'hex_bolt,DIN 933,12,75,carbon_steel,8.8,zinc,200,pcs,"Hex bolt, zinc plated"',
    ].join('\n');
    const lines = extractCsvLines(csv);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(200);
    expect(lines[0].unit).toBe('pcs');
  });

  it('extracts the three-row CSV fixture deterministically', () => {
    const lines = extractCsvLines(sampleText('09-clean-list.csv'));
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.diameterMm)).toEqual([12, 10, 8]);
  });
});
