import { describe, expect, it } from 'vitest';
import { dataCache } from '../../server/data.js';
import { handleAgentTurn } from '../../server/domain/conversation.js';
import { approveQuote } from '../../server/domain/workflow.js';
import { customer, emptyDocument, sampleText } from './helpers.js';

function deps() {
  return {
    customer: customer('CUST-001'),
    catalog: dataCache.catalog,
    rules: dataCache.pricingRules,
  };
}

describe('conversation workflow', () => {
  it('runs a first analysis turn and returns structured row results', async () => {
    const doc = emptyDocument('CUST-001', sampleText('08-multi-line.txt'));
    const next = await handleAgentTurn(doc, '审单，并告诉我哪些行不能报价', deps());

    expect(next.lines.map((line) => line.status)).toEqual([
      'PRICED',
      'NEEDS_CLARIFICATION',
      'NO_MATCH',
    ]);
    expect(next.agentTurns).toHaveLength(2);
    expect(next.agentTurns[1].payload?.kind).toBe('analysis');
    expect(next.agentTurns[1].payload?.lines).toHaveLength(3);
  });

  it('writes a human clarification and reprices the affected row', async () => {
    const doc = emptyDocument('CUST-001', sampleText('08-multi-line.txt'));
    const first = await handleAgentTurn(doc, '审单，并告诉我哪些行不能报价', deps());
    const next = await handleAgentTurn(first, '第二行表面处理是镀锌', deps());
    const row = next.lines.find((line) => line.lineIndex === 2);
    const quote = next.quotes.find((item) => item.id === next.currentQuoteId);

    expect(row?.status).toBe('PRICED');
    expect(row?.matchedSku).toBe('HB-M12X75-88-ZN');
    expect(row?.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'human', field: 'surfaceTreatment', verified: true }),
    ]));
    expect(quote?.lines).toHaveLength(2);
    expect(next.audit.some((event) => event.type === 'CHAT_UPDATE')).toBe(true);
  });

  it('explains why a catalog-outside row cannot be quoted', async () => {
    const doc = emptyDocument('CUST-001', sampleText('08-multi-line.txt'));
    const first = await handleAgentTurn(doc, '审单，并告诉我哪些行不能报价', deps());
    const next = await handleAgentTurn(first, '为什么第三行不能报价', deps());
    const payload = next.agentTurns.at(-1)?.payload;

    expect(payload?.kind).toBe('explanation');
    expect(payload?.summary).toContain('目录');
    expect(payload?.lines.find((line) => line.lineIndex === 3)?.status).toBe('NO_MATCH');
  });

  it('does not approve or export from conversation text', async () => {
    const doc = emptyDocument('CUST-001', sampleText('08-multi-line.txt'));
    const first = await handleAgentTurn(doc, '审单，并告诉我哪些行不能报价', deps());
    const next = await handleAgentTurn(first, '审批并导出 CSV', deps());
    const quote = next.quotes.find((item) => item.id === next.currentQuoteId);
    const payload = next.agentTurns.at(-1)?.payload;

    expect(quote?.status).toBe('READY_FOR_APPROVAL');
    expect(quote?.approvedBy).toBeNull();
    expect(payload?.kind).toBe('summary');
    expect(payload?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'approve', label: '去报价审批' }),
    ]));
    expect(next.audit.some((event) => event.type === 'APPROVED' || event.type === 'EXPORTED')).toBe(false);
  });

  it('keeps an approved quote locked against later specification edits', async () => {
    const doc = emptyDocument('CUST-001', sampleText('08-multi-line.txt'));
    const first = await handleAgentTurn(doc, '审单，并告诉我哪些行不能报价', deps());
    const clarified = await handleAgentTurn(first, '第二行表面处理是镀锌', deps());
    const approved = approveQuote(clarified, '王主管 / Supervisor');
    const quoteCount = approved.quotes.length;
    const next = await handleAgentTurn(approved, '第二行材质改为SS304', deps());

    expect(next.quotes).toHaveLength(quoteCount);
    expect(next.lines.find((line) => line.lineIndex === 2)?.material).toBe('carbon_steel');
    expect(next.agentTurns.at(-1)?.payload?.kind).toBe('blocked');
  });
});
