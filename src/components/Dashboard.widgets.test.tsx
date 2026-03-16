import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

const {
  pushSpy,
  replaceSpy,
  logViewSpy,
  apiGetSpy,
  apiPatchSpy,
} = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  replaceSpy: vi.fn(),
  logViewSpy: vi.fn(),
  apiGetSpy: vi.fn(() => Promise.resolve({ profile: {} })),
  apiPatchSpy: vi.fn(() => Promise.resolve({})),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/dashboard',
    push: pushSpy,
    replace: replaceSpy,
  }),
}));

vi.mock('../lib/auth', () => ({
  getUser: () => ({ username: 'test-user' }),
  getToken: () => 'test-token',
  clearToken: vi.fn(),
  apiGet: apiGetSpy,
  apiPatch: apiPatchSpy,
}));

vi.mock('../lib/ShopdataContext', () => ({
  useProjects: () => ({
    loading: false,
    projects: [],
  }),
  useViewHistory: () => ({
    loading: false,
    logView: logViewSpy,
    viewHistory: [
      {
        url: 'https://vendor.example/part-alpha',
        name: 'Part PCB Alpha',
        vendor: 'Vendor A',
        image: 'https://img.example/part-alpha.png',
        price: '$100',
        category: 'parts',
        viewedAt: new Date().toISOString(),
        viewCount: 2,
      },
    ],
  }),
  useFavorites: () => ({
    loading: false,
    favorites: [
      {
        url: 'https://vendor.example/favorite-beta',
        name: 'Favorite PCB Beta',
        vendor: 'Vendor B',
        image: 'https://img.example/favorite-beta.png',
        price: '$80',
        category: 'parts',
        favoritedAt: new Date().toISOString(),
      },
    ],
  }),
  useCommunityInsights: () => ({
    loading: false,
    error: null,
    entries: [],
  }),
  useFeedData: (widgetId: string) => {
    if (widgetId === 'keyboard-releases') {
      return {
        loading: false,
        error: null,
        sources: {},
        items: [
          {
            name: 'QK65 Keyboard Kit',
            price: '$99',
            comparePrice: '$129',
            url: 'https://vendor.example/qk65',
            _vendor: 'Vendor C',
            _sourceCategory: 'keyboards',
          },
          {
            name: 'No Link Keyboard Part',
            price: '$29',
            comparePrice: '$39',
            _vendor: 'Vendor D',
            _sourceCategory: 'parts',
          },
        ],
      };
    }

    return {
      loading: false,
      error: null,
      sources: {},
      items: [],
    };
  },
}));

describe('Dashboard widget rows', () => {
  beforeEach(() => {
    logViewSpy.mockClear();
    apiGetSpy.mockClear();
    apiPatchSpy.mockClear();
  });

  it('renders clickable listed product rows and logs history on click', () => {
    render(<Dashboard />);

    const historyRowLink = screen.getByRole('link', { name: /Part PCB Alpha/i });
    expect(historyRowLink).toHaveAttribute('href', 'https://vendor.example/part-alpha');

    fireEvent.click(historyRowLink);

    expect(logViewSpy).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://vendor.example/part-alpha',
      name: 'Part PCB Alpha',
      vendor: 'Vendor A',
      category: 'parts',
    }));
  });

  it('keeps missing-url feed rows non-clickable while showing the row text', () => {
    render(<Dashboard />);

    expect(screen.getAllByText('No Link Keyboard Part').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /No Link Keyboard Part/i })).not.toBeInTheDocument();

    const feedLinks = screen.getAllByRole('link', { name: /QK65 Keyboard Kit/i });
    expect(feedLinks.length).toBeGreaterThan(0);
    expect(feedLinks[0]).toHaveAttribute('href', 'https://vendor.example/qk65');
  });
});
