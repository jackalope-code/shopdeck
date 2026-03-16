import { describe, expect, it } from 'vitest';
import { getFeedStockStatus } from './stockStatus';

describe('getFeedStockStatus', () => {
  it('returns unknown when stock fields are missing', () => {
    expect(getFeedStockStatus({})).toBe('unknown');
  });

  it('prefers explicit stockStatus when present', () => {
    expect(getFeedStockStatus({ stockStatus: 'out-of-stock', anyAvailable: 'true' })).toBe('out-of-stock');
  });

  it('maps legacy booleans to normalized states', () => {
    expect(getFeedStockStatus({ anyAvailable: 'false' })).toBe('out-of-stock');
    expect(getFeedStockStatus({ anyAvailable: 'true', lowStock: 'true' })).toBe('low-stock');
    expect(getFeedStockStatus({ anyAvailable: 'true', partialStock: 'true' })).toBe('partial-stock');
    expect(getFeedStockStatus({ anyAvailable: 'true' })).toBe('in-stock');
  });
});
