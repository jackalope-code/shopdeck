import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isDemoAccount } from '../lib/auth';

const SESSION_KEY = 'sd-demo-banner-dismissed';

export default function DemoWarningBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isDemoAccount() && !sessionStorage.getItem(SESSION_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  }

  return (
    <div className="w-full bg-amber-500 text-white text-sm font-medium flex items-center justify-between px-4 py-2 gap-3 z-50">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-base shrink-0">info</span>
        <span className="truncate">
          Demo mode — settings are saved to this device only.{' '}
          <Link href="/register" className="underline underline-offset-2 hover:opacity-80 font-bold">
            Create a free account
          </Link>{' '}
          to save your work.
        </span>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 p-1 hover:opacity-70 transition-opacity rounded"
        aria-label="Dismiss"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
}
