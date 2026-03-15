process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { filterItemsForWidget } = require('../routes/feedConfig');

describe('feed data contracts', () => {
  it('keeps keyboard parts for keyboard-parts-release and rejects full kits', () => {
    const items = [
      {
        name: 'Hotswap PCB for 65% build',
        productType: 'PCB',
        price: '$49',
      },
      {
        name: 'Premium 65% Keyboard Kit',
        productType: 'Keyboard',
        price: '$199',
      },
    ];

    const filtered = filterItemsForWidget('keyboard-parts-release', items, 'keyboards');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toContain('Hotswap PCB');
  });

  it('keeps only keycaps for keycap-releases', () => {
    const items = [
      { name: 'GMK Aurora Keycap Set', productType: 'Keycaps' },
      { name: 'Linear Switch Sampler', productType: 'Switches' },
    ];

    const filtered = filterItemsForWidget('keycap-releases', items, 'keyboards');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toContain('Keycap');
  });

  it('keeps only switches for keyboard-switches', () => {
    const items = [
      { name: 'Silent Linear Switch Pack', productType: 'Switches' },
      { name: 'PBT keycap base kit', productType: 'Keycaps' },
    ];

    const filtered = filterItemsForWidget('keyboard-switches', items, 'keyboards');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toContain('Switch');
  });

  it('returns all items unchanged for non-keyboard widget ids', () => {
    const items = [
      { name: 'DDR5 32GB Kit' },
      { name: 'RTX 5080' },
    ];

    const filtered = filterItemsForWidget('ram-availability', items, 'electronics');

    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('DDR5 32GB Kit');
    expect(filtered[1].name).toBe('RTX 5080');
    expect(filtered[0].stockStatus).toBe('unknown');
    expect(filtered[1].stockStatus).toBe('unknown');
  });
});
