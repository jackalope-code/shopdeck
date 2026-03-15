export type NormalizedStockStatus = 'in-stock' | 'low-stock' | 'partial-stock' | 'out-of-stock' | 'unknown';

type StockSignals = {
  stockStatus?: string;
  anyAvailable?: string;
  lowStock?: string;
  partialStock?: string;
};

export function getFeedStockStatus(item: StockSignals): NormalizedStockStatus {
  const normalized = String(item.stockStatus || '').trim().toLowerCase();
  if (normalized === 'in-stock') return 'in-stock';
  if (normalized === 'low-stock') return 'low-stock';
  if (normalized === 'partial-stock') return 'partial-stock';
  if (normalized === 'out-of-stock') return 'out-of-stock';

  if (item.anyAvailable === 'false') return 'out-of-stock';
  if (item.lowStock === 'true') return 'low-stock';
  if (item.partialStock === 'true') return 'partial-stock';
  if (item.anyAvailable === 'true') return 'in-stock';
  return 'unknown';
}
