import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import KeyboardsCatalog from './KeyboardsCatalog';

const { routerState, routerReplaceSpy } = vi.hoisted(() => ({
  routerReplaceSpy: vi.fn(),
  routerState: {
    isReady: true,
    pathname: '/keyboards',
    query: {},
    replace: vi.fn(),
  },
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    ...routerState,
    replace: routerReplaceSpy,
  }),
}));

vi.mock('./ProjectsOverview', () => ({
  TopNav: () => <div>TopNav</div>,
}));

vi.mock('./HistoryAwareLink', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('../lib/ShopdataContext', () => ({
  useFeedData: () => ({
    loading: false,
    sources: {
      'test-source': {
        name: 'Test Source',
        data: [
          { name: 'Neo65 Modular Build', itemType: 'Modular-Kit', url: 'https://example.com/modular', price: '99' },
          { name: 'QK60 DIY Solder Kit', itemType: 'DIY-Kit', url: 'https://example.com/diy', price: '79' },
          { name: 'Assembled 75 Prebuilt Keyboard', itemType: 'Pre-built', url: 'https://example.com/prebuilt', price: '149' },
        ],
      },
    },
  }),
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

describe('KeyboardsCatalog subtype filters', () => {
  beforeEach(() => {
    routerState.isReady = true;
    routerState.pathname = '/keyboards';
    routerState.query = {};
    routerReplaceSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('hydrates subtype filters from URL query', async () => {
    routerState.query = { subkinds: 'modular-kit,prebuilt' };

    render(<KeyboardsCatalog />);

    expect(await screen.findByText('Neo65 Modular Build')).toBeInTheDocument();
    expect(screen.getByText('Assembled 75 Prebuilt Keyboard')).toBeInTheDocument();
    expect(screen.queryByText('QK60 DIY Solder Kit')).not.toBeInTheDocument();
  });

  it('supports multi-select chips and persists selected subkinds to URL', async () => {
    render(<KeyboardsCatalog />);

    fireEvent.click(screen.getAllByRole('button', { name: /^DIY Kit/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /^Modular Kit/i })[0]);

    await waitFor(() => expect(routerReplaceSpy).toHaveBeenCalled());

    const lastCall = routerReplaceSpy.mock.calls.at(-1);
    expect(lastCall?.[0]?.query?.subkinds).toBe('modular-kit,diy-kit');
    expect(screen.getByText('Neo65 Modular Build')).toBeInTheDocument();
    expect(screen.getByText('QK60 DIY Solder Kit')).toBeInTheDocument();
    expect(screen.queryByText('Assembled 75 Prebuilt Keyboard')).not.toBeInTheDocument();
  });
});
