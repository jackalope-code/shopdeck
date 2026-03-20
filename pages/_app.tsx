import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../src/index.css';
import AIAgent from '../src/components/AIAgent';
import DemoWarningBanner from '../src/components/DemoWarningBanner';
import { ShopdataProvider } from '../src/lib/ShopdataContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { isLoggedIn, setToken, setUser } from '../src/lib/auth';

const isDev = process.env.NODE_ENV !== 'production';

// DevPanel is only imported + bundled in non-production environments
const DevPanel = isDev ? require('../src/components/DevPanel').default : null;

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

const DEV_AUTO_LOGIN = isDev && process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN === 'true';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    if (!DEV_AUTO_LOGIN) return;
    const authFreeRoutes = ['/login', '/register', '/verify-email'];
    if (authFreeRoutes.includes(router.pathname)) return;
    if (isLoggedIn()) return;
    fetch('/api/auth/developer', { method: 'POST' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setToken(data.token);
        setUser(data.user);
        router.replace(router.asPath);
      })
      .catch(() => { /* silently skip — backend may not be running */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ShopdataProvider>
        <DemoWarningBanner />
        <Component {...pageProps} />
        {/* AIAgent is globally mounted so it works from any page (Dashboard, MyElectronics, etc.) */}
        <AIAgent />
        {isDev && DevPanel && <DevPanel />}
      </ShopdataProvider>
    </GoogleOAuthProvider>
  );
}
