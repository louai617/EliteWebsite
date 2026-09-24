'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface SortSelectProps {
  label: string;
  value: string;
}

/** Listing sort control — writes `?sort=` so the server renders the sorted page. */
export default function SortSelect({ label, value }: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', event.target.value);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      aria-label={label}
      value={value}
      onChange={onChange}
      className="rounded-lg border border-gray-200 bg-white px-4 py-2 outline-none transition focus:border-primary"
    >
      <option value="newest">Newest First</option>
      <option value="price-low">Price: Low to High</option>
      <option value="price-high">Price: High to Low</option>
    </select>
  );
}
