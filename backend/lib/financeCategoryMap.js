// backend/lib/financeCategoryMap.js
// Maps common bank CSV transaction category strings to ShopDeck category IDs.
// Returns null when no meaningful mapping exists (travel, utilities, health, etc.)

const BANK_CAT_TO_SHOPDECK = {
  // Groceries / Food
  'food & drink':            'groceries',
  'food and drink':          'groceries',
  'restaurants':             'groceries',
  'fast food':               'groceries',
  'coffee shops':            'groceries',
  'grocery':                 'groceries',
  'groceries':               'groceries',
  'supermarkets':            'groceries',
  'food':                    'groceries',
  'dining':                  'groceries',

  // Clothing / Shopping
  'shopping':                'clothes',
  'clothing':                'clothes',
  'fashion':                 'clothes',
  'apparel':                 'clothes',
  'department stores':       'clothes',

  // Shoes
  'shoes':                   'shoes',
  'shoe stores':             'shoes',

  // Electronics / Computing
  'electronics':             'electronics',
  'electronics & software':  'electronics',
  'computer & electronics':  'electronics',
  'computers':               'pc-building',

  // Automotive
  'automotive':              'automotive',
  'gas':                     'automotive',
  'gas stations':            'automotive',
  'service stations':        'automotive',
  'auto & transport':        'automotive',
  'auto & transportation':   'automotive',
  'auto':                    'automotive',

  // Home / Furniture
  'home':                    'home',
  'furniture':               'home',
  'home furnishings':        'home',

  // Home Improvement
  'home improvement':        'home-improvement',
  'hardware stores':         'home-improvement',
  'hardware':                'home-improvement',

  // Garden
  'home & garden':           'garden',
  'garden':                  'garden',
  'nurseries':               'garden',

  // Entertainment / Games
  'entertainment':           'games',
  'games':                   'games',
  'gaming':                  'games',
  'video games':             'games',
  'movies & dvds':           'games',
  'movies':                  'games',
  'amusement':               'games',

  // Sports / Outdoors
  'sports':                  'sports',
  'sporting goods':          'sports',
  'sports & outdoors':       'sports',
  'fitness':                 'sports',
  'outdoors':                'sports',

  // Art / Crafts / Hobbies
  'arts':                    'art',
  'art supplies':            'art',
  'crafts':                  'crafts',
  'hobbies':                 'crafts',
  'hobby':                   'crafts',

  // 3D Printing / Maker
  '3d printing':             '3dprinting',
};

/**
 * Map a raw bank CSV category string to a ShopDeck category ID.
 * Returns null if no match.
 * @param {string|null|undefined} rawCategory
 * @returns {string|null}
 */
function mapCategory(rawCategory) {
  if (!rawCategory) return null;
  return BANK_CAT_TO_SHOPDECK[rawCategory.toLowerCase().trim()] ?? null;
}

module.exports = { mapCategory };
