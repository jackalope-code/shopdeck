import dynamic from 'next/dynamic';

const Favorites = dynamic(() => import('../src/components/Favorites'), { ssr: false });

export default Favorites;
