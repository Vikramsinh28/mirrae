/**
 * Marketing home page copy. Every claim here must match what the product does today
 * (see CLAUDE.md). No invented stats, logos, reviews or customer counts.
 */

export interface MarketingNavItem {
  readonly label: string;
  readonly href: string;
}

export const MARKETING_NAV: readonly MarketingNavItem[] = [
  { label: 'How it works', href: '/#how' },
  { label: 'Range', href: '/#range' },
  { label: 'Privacy', href: '/#privacy' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

export const BRAND_CATEGORIES: readonly string[] = [
  'Shirts',
  'Knitwear',
  'Dresses',
  'Saree',
  'Lehenga',
  'Outerwear',
  'Denim',
];

export interface RangeItem {
  readonly category: string;
  readonly garment: string;
  readonly result: string;
  readonly garmentPhoto: string;
  readonly alt: string;
}

export const RANGE_ITEMS: readonly RangeItem[] = [
  {
    category: 'Shirts',
    garment: 'Blue striped shirt',
    result: '/marketing/range-shirt.jpg',
    garmentPhoto: '/marketing/range-shirt-garment.jpg',
    alt: 'Man wearing a blue shirt',
  },
  {
    category: 'Knitwear',
    garment: 'White knit sweater',
    result: '/marketing/range-knit.jpg',
    garmentPhoto: '/marketing/range-knit-garment.jpg',
    alt: 'Man wearing a white knit sweater',
  },
  {
    category: 'Dresses',
    garment: 'White midi dress',
    result: '/marketing/range-dress.jpg',
    garmentPhoto: '/marketing/range-dress-garment.jpg',
    alt: 'Woman wearing a white midi dress',
  },
  {
    category: 'Saree',
    garment: 'Red printed saree',
    result: '/marketing/range-saree.jpg',
    garmentPhoto: '/marketing/range-saree-garment.jpg',
    alt: 'Woman wearing a red saree',
  },
  {
    category: 'Saree, from a flat-lay',
    garment: 'Bandhani saree, folded',
    result: '/marketing/range-bandhani.jpg',
    garmentPhoto: '/marketing/range-bandhani-garment.jpg',
    alt: 'Woman wearing a blue bandhani saree',
  },
  {
    category: 'Lehenga',
    garment: 'Green lehenga set',
    result: '/marketing/range-lehenga.jpg',
    garmentPhoto: '/marketing/range-lehenga-garment.jpg',
    alt: 'Woman wearing a green lehenga',
  },
];

export interface MarketingStep {
  readonly title: string;
  readonly body: string;
}

export const MARKETING_STEPS: readonly MarketingStep[] = [
  {
    title: 'Paste one line',
    body: 'Add the Mirrae script to your store. Your product images are picked up automatically.',
  },
  {
    title: 'A button appears',
    body: 'Shoppers see “Try it on” on your product pages and add one photo, after agreeing to how it is used.',
  },
  {
    title: 'They see it on themselves',
    body: 'About 30 seconds later they get a realistic result: front first, then side and back.',
  },
];

export const FREE_CREDITS_NOTE = '5 free credits to start. No card.';
