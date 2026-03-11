import type { AppProps } from 'next/app';
import '../src/index.css';
import AIAgent from '../src/components/AIAgent';
import { ShopdataProvider } from '../src/lib/ShopdataContext';

const isDev = process.env.NODE_ENV !== 'production';

// DevPanel is only imported + bundled in non-production environments
const DevPanel = isDev ? require('../src/components/DevPanel').default : null;

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ShopdataProvider>
      <Component {...pageProps} />
      {/* AIAgent is globally mounted so it works from any page (Dashboard, MyElectronics, etc.) */}
      <AIAgent />
      {isDev && DevPanel && <DevPanel />}
    </ShopdataProvider>
  );
}
