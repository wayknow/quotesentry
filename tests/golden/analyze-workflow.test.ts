import { describe, expect, it } from 'vitest';
import { dataCache } from '../../server/data.js';
import { approveQuote, assertSendAllowed, overrideMarginAlert } from '../../server/domain/workflow.js';
import { AppError } from '../../server/errors.js';
import { analyzeCsv, analyzeText, customer } from './helpers.js';

describe('line-level analysis', () => {
  it('produces priced, clarification and no-match rows in one document', () => {
    const doc = analyzeText('08-multi-line.txt', 'CUST-001');
    expect(doc.lines.map((line) => line.status)).toEqual(['PRICED', 'NEEDS_CLARIFICATION', 'NO_MATCH']);
    expect(doc.lines[0].matchedSku).toBe('HB-M12X75-88-ZN');
    expect(doc.lines[1].missingFields).toContain('surfaceTreatment');
    expect(doc.lines[2].matchedSku).toBeNull();
    expect(doc.status).toBe('NEEDS_REVIEW');
    expect(doc.currentQuoteId).toBeTruthy();
    expect(doc.quotes[0].lines).toHaveLength(1);
  });

  it('prices a clean email and keeps the quote ready for approval', () => {
    const doc = analyzeText('01-clean-email.txt', 'CUST-001');
    expect(doc.lines[0].status).toBe('PRICED');
    expect(doc.status).toBe('READY_FOR_APPROVAL');
    expect(doc.quotes[0].marginPct).toBeGreaterThanOrEqual(dataCache.pricingRules.minimumMarginPct);
  });

  it('flags a missing finish without generating a price', () => {
    const doc = analyzeText('02-missing-finish.txt', 'CUST-001');
    expect(doc.lines[0].status).toBe('NEEDS_CLARIFICATION');
    expect(doc.lines[0].pricing).toBeNull();
  });

  it('does not guess a previous order', () => {
    const doc = analyzeText('05-same-as-last-time.txt', 'CUST-001');
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0].status).toBe('NEEDS_CLARIFICATION');
    expect(doc.lines[0].matchedSku).toBeNull();
  });

  it('recognizes a partial-thread DIN 931 request', () => {
    const doc = analyzeText('07-partial-thread.txt', 'CUST-001');
    expect(doc.lines[0].matchedSku).toBe('HB-M10X60-88-ZN-PT');
    expect(doc.lines[0].status).toBe('PRICED');
  });

  it('prices every row in the clean CSV', () => {
    const doc = analyzeCsv('09-clean-list.csv', 'CUST-002');
    expect(doc.lines).toHaveLength(3);
    expect(doc.lines.every((line) => line.status === 'PRICED')).toBe(true);
    expect(doc.quotes[0].lines).toHaveLength(3);
  });
});

describe('approval and override', () => {
  it('blocks approval of a margin breach until a reason is recorded', () => {
    const doc = analyzeText('06-margin-breach.txt', 'CUST-003');
    expect(doc.lines[0].status).toBe('MARGIN_ALERT');
    expect(() => approveQuote(doc, 'Supervisor')).toThrowError(/override/);

    const overridden = overrideMarginAlert(
      doc,
      doc.lines[0].id,
      'Annual framework customer; accept this low-margin spare-parts order.',
      'Supervisor',
    );
    expect(overridden.lines[0].status).toBe('PRICED');
    expect(overridden.quotes[0].overrides).toHaveLength(1);
    expect(overridden.audit.at(-1)?.type).toBe('OVERRIDE');

    const approved = approveQuote(overridden, 'Supervisor');
    expect(approved.quotes[0].status).toBe('APPROVED');
    expect(approved.lines[0].status).toBe('APPROVED');
    expect(approved.status).toBe('APPROVED');
  });

  it('allows approving the priced subset while other rows stay blocked', () => {
    const doc = analyzeText('08-multi-line.txt', 'CUST-001');
    const approved = approveQuote(doc, 'Supervisor');
    expect(approved.quotes[0].status).toBe('APPROVED');
    expect(approved.lines.map((line) => line.status)).toEqual(['APPROVED', 'NEEDS_CLARIFICATION', 'NO_MATCH']);
    expect(approved.status).toBe('NEEDS_REVIEW');
  });

  it('refuses override for missing data, not just margin', () => {
    const doc = analyzeText('02-missing-finish.txt', 'CUST-001');
    expect(() => overrideMarginAlert(doc, doc.lines[0].id, 'Try to bypass this', 'Supervisor'))
      .toThrowError(/只有毛利越界行/);
  });
});

describe('external send safety', () => {
  it('always rejects send when SEND_MODE is disabled', () => {
    expect(() => assertSendAllowed('disabled')).toThrowError(AppError);
    try {
      assertSendAllowed('disabled');
    } catch (error) {
      expect((error as AppError).status).toBe(403);
      expect((error as AppError).code).toBe('SEND_DISABLED');
    }
  });

  it('does not pretend that an unconfigured channel sent anything', () => {
    try {
      assertSendAllowed('demo');
    } catch (error) {
      expect((error as AppError).status).toBe(501);
      expect((error as AppError).code).toBe('SEND_NOT_CONFIGURED');
    }
  });
});

describe('source-of-truth references', () => {
  it('uses the catalog and customer rule set, not request-supplied pricing fields', () => {
    const doc = analyzeText('01-clean-email.txt', 'CUST-001');
    const line = doc.lines[0];
    expect(line.pricing?.baseExwPriceCny).toBe(18.2);
    expect(line.pricing?.customerDiscount).toBe(customer('CUST-001').discount);
    expect(line.evidence.every((item) => item.verified)).toBe(true);
  });
});
