import dynamic from 'next/dynamic';

const RecentlyViewed = dynamic(() => import('../src/components/RecentlyViewed'), { ssr: false });

export default RecentlyViewed;