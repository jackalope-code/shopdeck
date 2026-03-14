import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/components/Dashboard', () => ({
  default: () => <div>DashboardPageComponent</div>,
}));

vi.mock('../src/components/ActiveDealsDashboard', () => ({
  default: () => <div>ActiveDealsPageComponent</div>,
}));

vi.mock('../src/components/Drops', () => ({
  default: () => <div>DropsPageComponent</div>,
}));

describe('page route composition', () => {
  it('maps /dashboard page to dashboard component', async () => {
    const mod = await import('./dashboard');
    const DashboardPage = mod.default;
    render(<DashboardPage />);
    expect(screen.getByText('DashboardPageComponent')).toBeInTheDocument();
  });

  it('maps /active-deals page to active deals component', async () => {
    const mod = await import('./active-deals');
    const ActiveDealsPage = mod.default;
    render(<ActiveDealsPage />);
    expect(screen.getByText('ActiveDealsPageComponent')).toBeInTheDocument();
  });

  it('maps /drops page to drops component', async () => {
    const mod = await import('./drops');
    const DropsPage = mod.default;
    render(<DropsPage />);
    expect(screen.getByText('DropsPageComponent')).toBeInTheDocument();
  });
});
