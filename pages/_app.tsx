import type { AppProps } from 'next/app';
import '../src/index.css';
import AIAgent from '../src/components/AIAgent';
import DemoWarningBanner from '../src/components/DemoWarningBanner';
import { ShopdataProvider } from '../src/lib/ShopdataContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

const isDev = process.env.NODE_ENV !== 'production';

// DevPanel is only imported + bundled in non-production environments
const DevPanel = isDev ? require('../src/components/DevPanel').default : null;

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function App({ Component, pageProps }: AppProps) {
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
