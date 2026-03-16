'use strict';

const OOS_TITLE_PATTERNS = /\b(?:group\s*buy\s*ended?|gb\s*ended?|sale\s*ended?|ic\s*ended?|interest\s*check\s*ended?|sold\s*out|out\s*of\s*stock|no\s*longer\s*available|discontinued|closed|ended)\b/i;
const IN_STOCK_TITLE_PATTERNS = /\b(?:in\s*stock|available\s*now|ships?\s*now|ready\s*to\s*ship|rts|buy\s*now)\b/i;
const CONDITIONAL_TITLE_PATTERNS = /\b(?:pre\s*-?order|preorder|coming\s*soon|subject\s*to|production\s*delay|back\s*order|backorder)\b/i;

function classifyVariantByText(title = '') {
  if (OOS_TITLE_PATTERNS.test(title)) return 'unavailable';
  if (CONDITIONAL_TITLE_PATTERNS.test(title)) return 'unknown';
  if (IN_STOCK_TITLE_PATTERNS.test(title)) return 'available';
  return 'unknown';
}

function buildStockFields(availableCount, variantCount) {
  if (variantCount <= 0) {
    return { stockStatus: 'unknown' };
  }

  const anyAvailable = availableCount > 0;
  const availableRatio = availableCount / variantCount;
  const lowStock = anyAvailable && availableRatio < 0.25;
  const partialStock = anyAvailable && !lowStock && availableRatio <= 0.5;
  const stockStatus = !anyAvailable
    ? 'out-of-stock'
    : lowStock
      ? 'low-stock'
      : partialStock
        ? 'partial-stock'
        : 'in-stock';

  return {
    anyAvailable: anyAvailable ? 'true' : 'false',
    lowStock: lowStock ? 'true' : 'false',
    partialStock: partialStock ? 'true' : 'false',
    variantCount: String(variantCount),
    availableCount: String(availableCount),
    stockStatus,
  };
}

function analyzeVariantStock(container = {}) {
  const variants = Array.isArray(container.variants) ? container.variants : [];
  if (variants.length === 0) return {};

  const out = {};
  const variantDetails = [];
  const shopifyTracked = variants.filter(v => v.inventory_management === 'shopify');

  if (shopifyTracked.length > 0) {
    const shopifyAvailable = shopifyTracked.filter(v =>
      v.inventory_policy === 'continue' || (parseInt(v.inventory_quantity, 10) || 0) > 0
    );
    Object.assign(out, buildStockFields(shopifyAvailable.length, shopifyTracked.length));
    const totalQty = shopifyTracked.reduce((acc, v) => acc + (parseInt(v.inventory_quantity, 10) || 0), 0);
    if (totalQty > 0) out.totalInventory = String(totalQty);

    for (const variant of shopifyTracked) {
      const qty = parseInt(variant.inventory_quantity, 10) || 0;
      const available = variant.inventory_policy === 'continue' || qty > 0;
      const detail = { title: variant.title || 'Default', available, source: 'shopify' };
      if (variant.price) detail.price = variant.price;
      if (qty > 0) detail.qty = qty;
      variantDetails.push(detail);
    }
  } else {
    const availabilityTracked = variants.filter(variant => typeof variant.available === 'boolean');
    if (availabilityTracked.length > 0) {
      const availableCount = availabilityTracked.filter(variant => variant.available === true).length;
      Object.assign(out, buildStockFields(availableCount, availabilityTracked.length));

      for (const variant of availabilityTracked) {
        const qty = parseInt(variant.inventory_quantity, 10) || 0;
        const detail = { title: variant.title || 'Default', available: variant.available === true, source: 'shopify' };
        if (variant.price) detail.price = variant.price;
        if (qty > 0) detail.qty = qty;
        variantDetails.push(detail);
      }
    } else {
    const textTracked = [];
    for (const variant of variants) {
      const classification = classifyVariantByText(variant.title || '');
      if (classification === 'unknown') continue;

      const available = classification === 'available';
      const detail = { title: variant.title || 'Default', available, source: 'text' };
      if (variant.price) detail.price = variant.price;
      textTracked.push(detail);
      variantDetails.push(detail);
    }

    if (textTracked.length > 0) {
      const availCount = textTracked.filter(detail => detail.available).length;
      Object.assign(out, buildStockFields(availCount, textTracked.length));
    } else {
      const productText = [
        container.title || '',
        Array.isArray(container.tags) ? container.tags.join(' ') : (container.tags || ''),
      ].join(' ');
      if (OOS_TITLE_PATTERNS.test(productText)) {
        out.anyAvailable = 'false';
        out.stockStatus = 'out-of-stock';
      }
    }
    }
  }

  if (variantDetails.length > 0) out._variants = variantDetails;

  const prices = variants
    .map(variant => parseFloat(variant.price))
    .filter(price => price > 0);
  if (prices.length > 0) {
    out.priceMin = String(Math.min(...prices));
    out.priceMax = String(Math.max(...prices));
  }

  return out;
}

function inferStockStatus(item = {}) {
  const stockStatus = String(item.stockStatus || '').trim().toLowerCase();
  if (stockStatus === 'in-stock') return 'in-stock';
  if (stockStatus === 'low-stock') return 'low-stock';
  if (stockStatus === 'partial-stock') return 'partial-stock';
  if (stockStatus === 'out-of-stock') return 'out-of-stock';

  if (item.anyAvailable === 'false') return 'out-of-stock';
  if (item.lowStock === 'true') return 'low-stock';
  if (item.partialStock === 'true') return 'partial-stock';
  if (item.anyAvailable === 'true') return 'in-stock';
  return 'unknown';
}

function normalizeStockFields(item = {}) {
  const stockStatus = inferStockStatus(item);
  if (stockStatus === item.stockStatus) return item;
  return { ...item, stockStatus };
}

module.exports = {
  classifyVariantByText,
  analyzeVariantStock,
  inferStockStatus,
  normalizeStockFields,
};
