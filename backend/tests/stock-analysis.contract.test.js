const { analyzeVariantStock, inferStockStatus, normalizeStockFields } = require('../lib/stockAnalysis');

describe('stock analysis contracts', () => {
  it('marks product out-of-stock when all shopify-tracked variants are unavailable', () => {
    const item = analyzeVariantStock({
      title: 'Hope Keyboard',
      variants: [
        { title: 'Black Kit', inventory_management: 'shopify', inventory_quantity: 0, inventory_policy: 'deny', price: '299' },
        { title: 'Silver Kit', inventory_management: 'shopify', inventory_quantity: 0, inventory_policy: 'deny', price: '299' },
      ],
    });

    expect(item.stockStatus).toBe('out-of-stock');
    expect(item.anyAvailable).toBe('false');
    expect(item.availableCount).toBe('0');
    expect(item.variantCount).toBe('2');
    expect(item.priceMin).toBe('299');
    expect(item.priceMax).toBe('299');
  });

  it('keeps unknown stock when no stock signals exist', () => {
    expect(inferStockStatus({ name: 'Random listing' })).toBe('unknown');
    expect(normalizeStockFields({ name: 'Random listing' }).stockStatus).toBe('unknown');
  });

  it('maps low and partial stock from legacy boolean fields', () => {
    expect(inferStockStatus({ lowStock: 'true', anyAvailable: 'true' })).toBe('low-stock');
    expect(inferStockStatus({ partialStock: 'true', anyAvailable: 'true' })).toBe('partial-stock');
  });
});
