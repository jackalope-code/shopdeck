import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../src/lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    // Dev-only: if force-onboarding flag is set, clear it and go to onboarding
    if (process.env.NODE_ENV !== 'production' &&
        localStorage.getItem('sd-dev-force-onboarding') === 'true') {
      localStorage.removeItem('sd-dev-force-onboarding');
      localStorage.removeItem('sd-onboarded');
      router.replace('/onboarding');
      return;
    }
    // Dev-only: always show onboarding (demo loop) — flag persists until disabled
    if (process.env.NODE_ENV !== 'production' &&
        localStorage.getItem('sd-dev-always-onboarding') === 'true') {
      router.replace('/onboarding');
      return;
    }
    const onboarded = localStorage.getItem('sd-onboarded') === 'true';
    router.replace(onboarded ? '/dashboard' : '/onboarding');
  }, [router]);
  return null;
}
