import {
  Coins,
  Lock,
  type LucideIcon,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Timer,
  Trash2,
  Upload,
  ShieldCheck,
} from 'lucide-react';

/**
 * Landing page copy. Every claim here must match what the product actually does
 * (see CLAUDE.md "Try-On feature invariants"). No invented stats or testimonials.
 */

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly sectionId: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'How it works', href: '/#how', sectionId: 'how' },
  { label: 'Features', href: '/#features', sectionId: 'features' },
  { label: 'Privacy', href: '/#privacy', sectionId: 'privacy' },
  { label: 'Pricing', href: '/#pricing', sectionId: 'pricing' },
  { label: 'Blog', href: '/blog', sectionId: '' },
];

// Every landing section the nav scroll-spy watches, including ones without a nav link
export const SECTION_IDS = [
  'home',
  'demo',
  'idea',
  'how',
  'features',
  'privacy',
  'pricing',
  'faq',
  'cta',
] as const;

export interface Step {
  readonly title: string;
  readonly body: string;
  readonly icon: LucideIcon;
}

export const STEPS: readonly Step[] = [
  {
    title: 'A shopper adds one photo',
    body: 'They tap “Try it on” on a product page and upload a single photo of themselves, after agreeing to how it is used.',
    icon: Upload,
  },
  {
    title: 'Mirrae dresses them in your product',
    body: 'Their photo and your product image go to a try-on model that fits the garment to their body, pose and proportions.',
    icon: Shirt,
  },
  {
    title: 'They see it on themselves',
    body: 'About 20–40 seconds later, a realistic composite appears. No app to install, no measuring tape.',
    icon: Sparkles,
  },
];

export interface Benefit {
  readonly title: string;
  readonly body: string;
  readonly icon: LucideIcon;
  /** Tailwind grid span classes for the bento layout. */
  readonly span: string;
}

export const BENEFITS: readonly Benefit[] = [
  {
    title: 'Confidence at the moment of decision',
    body: 'Models are not your customers. Letting shoppers see a piece on a real person, themselves, replaces guesswork about fit and drape with a clear picture.',
    icon: Sparkles,
    span: 'lg:col-span-2 lg:row-span-2',
  },
  {
    title: 'Ready in about 30 seconds',
    body: 'The front view usually arrives in under 30 seconds; side and back views follow shortly after.',
    icon: Timer,
    span: '',
  },
  {
    title: 'Pay per try-on',
    body: 'A front-view try-on is one credit; front, side and back together are two. A try-on that fails is never charged.',
    icon: Coins,
    span: '',
  },
  {
    title: 'Uses the images you already have',
    body: 'Your existing product photography is all it needs. No special shoot, no 3D models.',
    icon: Store,
    span: '',
  },
  {
    title: 'Made for phones',
    body: 'Most shoppers browse on mobile, so the flow starts with the camera roll or a quick selfie.',
    icon: Smartphone,
    span: '',
  },
];

export interface Promise {
  readonly title: string;
  readonly body: string;
  readonly icon: LucideIcon;
}

export const PRIVACY_PROMISES: readonly Promise[] = [
  {
    title: 'Consent comes first',
    body: 'A try-on cannot start until the shopper explicitly agrees to their photo being processed.',
    icon: ShieldCheck,
  },
  {
    title: 'Photos are deleted after use',
    body: 'The shopper’s photo is removed as soon as the result is made, including when a try-on fails.',
    icon: Trash2,
  },
  {
    title: 'Private by default',
    body: 'Photos sit in private storage and reach the try-on provider only through short-lived links.',
    icon: Lock,
  },
];

export const PRICING_POINTS: readonly string[] = [
  'A front-view try-on costs one credit; front, side and back cost two',
  'Failed try-ons are never charged',
  'Top up whenever you need more',
  'Every charge is itemised in your credit history',
];

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export const FAQS: readonly FaqItem[] = [
  {
    question: 'Does it work with Shopify?',
    answer:
      'A one-click Shopify app is next on our roadmap. Today you can run real try-ons in the demo, and you can join the waitlist so we tell you the moment the app is ready.',
  },
  {
    question: 'What does a shopper need to provide?',
    answer:
      'One clear photo of themselves. A well-lit, front-facing, full-body photo gives the best result.',
  },
  {
    question: 'How long does a try-on take?',
    answer:
      'Usually 20–40 seconds. If something goes wrong, the shopper sees a clear message and nothing is charged.',
  },
  {
    question: 'What happens to the shopper’s photo?',
    answer:
      'It is used only to create the try-on and is deleted as soon as the result is ready, even when the try-on fails. Shoppers must give consent before anything is processed.',
  },
  {
    question: 'How does billing work?',
    answer:
      'Usage-based: a front-view try-on is one credit, and front, side and back together are two. You only spend credits when a try-on succeeds (if the side and back views fail, you pay just one credit), and every charge appears in your credit history.',
  },
  {
    question: 'Are the side and back views exact?',
    answer:
      'They are generated from the front result and the product photo. If the product photo shows only the front, the back is a plausible estimate rather than a photograph of the real garment.',
  },
  {
    question: 'Which products does it support?',
    answer:
      'Mirrae is built for apparel such as tops, bottoms and dresses. Footwear and accessories are not supported yet.',
  },
];
