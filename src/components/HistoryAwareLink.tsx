import React from 'react';
import { useViewHistory } from '../lib/ShopdataContext';

type HistoryLinkItem = {
  name: string;
  url: string;
  image?: string;
  price?: string;
  vendor?: string;
  category?: string;
};

type HistoryAwareLinkProps = React.ComponentPropsWithoutRef<'a'> & {
  href: string;
  item: HistoryLinkItem;
};

export default function HistoryAwareLink({ href, item, onClick, rel, target, ...props }: HistoryAwareLinkProps) {
  const { logView } = useViewHistory();

  return (
    <a
      {...props}
      href={href}
      target={target ?? '_blank'}
      rel={rel ?? 'noopener noreferrer'}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        logView({
          url: item.url,
          name: item.name,
          image: item.image,
          price: item.price,
          vendor: item.vendor,
          category: item.category,
        });
      }}
    />
  );
}