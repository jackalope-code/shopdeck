const { inferKeyboardSubkind } = require('../lib/productTaxonomy');

describe('keyboard subkind inference', () => {
  it('detects prebuilt keyboards with highest precedence', () => {
    const subkind = inferKeyboardSubkind({
      name: 'Neo75 fully built keyboard kit',
      itemType: 'Pre-built',
    });

    expect(subkind).toBe('prebuilt');
  });

  it('detects modular kits from hotswap/modular signals', () => {
    const subkind = inferKeyboardSubkind({
      name: '65% Modular Hotswap Keyboard',
      tags: 'modular;hot-swap',
    });

    expect(subkind).toBe('modular-kit');
  });

  it('detects diy kits from solder/unassembled signals', () => {
    const subkind = inferKeyboardSubkind({
      name: '60% DIY solder keyboard kit',
      tags: 'diy;unassembled',
    });

    expect(subkind).toBe('diy-kit');
  });

  it('keeps barebones independent from kits', () => {
    const subkind = inferKeyboardSubkind({
      name: '75% Barebones Case Only',
      itemType: 'Barebones',
    });

    expect(subkind).toBe('barebones');
  });
});
