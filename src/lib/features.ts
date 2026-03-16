// src/lib/features.ts
// Fetches server-side feature flags once and caches them for the page lifecycle.
// Falls back to all-off on network error so the app degrades gracefully.
import { useEffect, useState } from 'react';

export interface AppFeatures {
  plaid: boolean;
  github_oauth: boolean;
  google_oauth: boolean;
  email_verification: boolean;
}

const DEFAULT_FEATURES: AppFeatures = { plaid: false, github_oauth: false, google_oauth: false, email_verification: false };

// Module-level cache — fetched at most once per page load.
let _cache: AppFeatures | null = null;
let _inflight: Promise<AppFeatures> | null = null;

export async function getFeatures(): Promise<AppFeatures> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  const p: Promise<AppFeatures> = fetch('/api/features')
    .then(r => r.ok ? r.json() as Promise<AppFeatures> : DEFAULT_FEATURES)
    .catch((): AppFeatures => DEFAULT_FEATURES)
    .then((data): AppFeatures => {
      _cache = { ...DEFAULT_FEATURES, ...data };
      _inflight = null;
      return _cache;
    });
  _inflight = p;
  return p;
}

export function useFeatures(): AppFeatures {
  const [features, setFeatures] = useState<AppFeatures>(DEFAULT_FEATURES);
  useEffect(() => {
    getFeatures().then(setFeatures);
  }, []);
  return features;
}
