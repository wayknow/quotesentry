import { describe, expect, it } from 'vitest';
import { dataCache } from '../../server/data.js';
import { calculateQuoteTotals, priceCatalogLine } from '../../server/domain/pricing.js';
import { customer } from './helpers.js';

describe('deterministic pricing', () => {
  const rules = dataCache.pricingRules;
  const sku = dataCache.catalog.find((item) => item.sku === 'HB-M12X75-88-ZN');

  it('matches the golden line and quote totals for the clean sample', () => {
    if (!sku) throw new Error('Golden SKU missing');
    const line = priceCatalogLine({ sku, quantity: 200, customer: customer('CUST-001'), rules });
    const totals = calculateQuoteTotals([line], rules);

    expect(line.unitPriceCny).toBe(16.74);
    expect(line.lineNetCny).toBe(3348);
    expect(line.lineCostCny).toBe(2522);
    expect(line.currencyAmount).toBe(465);
    expect(totals.feesCny).toBe(120);
    expect(totals.marginCny).toBe(706);
    expect(totals.marginPct).toBe(21.09);
    expect(totals.currencyTotal).toBe(465);
  });

  it('uses the largest quantity tier at or below the order quantity', () => {
    if (!sku) throw new Error('Golden SKU missing');
    const line = priceCatalogLine({ sku, quantity: 1000, customer: customer('CUST-001'), rules });
    expect(line.quantityTierFactor).toBe(0.94);
    expect(line.tierLabel).toContain('1,000');
  });

  it('keeps the margin-breach sample below the configured floor', () => {
    const marginSku = dataCache.catalog.find((item) => item.sku === 'HB-M6X20-88-ZN');
    if (!marginSku) throw new Error('Margin SKU missing');
    const line = priceCatalogLine({ sku: marginSku, quantity: 100, customer: customer('CUST-003'), rules });
    const totals = calculateQuoteTotals([line], rules);
    expect(totals.marginPct).toBeLessThan(rules.minimumMarginPct);
    expect(totals.marginPct).toBe(-140.91);
  });
});
