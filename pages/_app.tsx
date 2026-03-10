import type { AppProps } from 'next/app';
import '../src/index.css';

const isDev = process.env.NODE_ENV !== 'production';

// DevPanel is only imported + bundled in non-production environments
const DevPanel = isDev ? require('../src/components/DevPanel').default : null;

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      {isDev && DevPanel && <DevPanel />}
    </>
  );
}
