export const siteConfig = {
  name: 'Mirrae',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  description:
    'Virtual try-on for online fashion stores. Shoppers upload one photo and see themselves in your product in about 30 seconds.',
  baseLinks: {
    // Public routes
    landing: '/',

    // App routes
    home: '/app',
    try: '/app/try',
    shops: '/app/shops',
    blogs: '/app/blogs',
    categories: '/app/categories',
    packages: '/app/packages',
    files: '/app/files',
    creditHistory: '/app/credit-history',

    // Settings routes
    settings: {
      users: '/app/settings/users',
      general: '/app/settings/general',
      billing: '/app/settings/billing',
    },

    // Admin routes
    admin: {
      dashboard: '/app/admin',
      users: '/app/admin/users',
    },

    // Other routes
    onboarding: '/onboarding',
    privacy: '/privacy-policy',
    terms: '/terms-of-services',
  },
  sitemap: {
    // URL priorities for sitemap generation
    priorities: {
      high: 1.0, // Landing page
      medium: 0.8, // Important pages (privacy, terms, main app)
      low: 0.6, // Secondary pages (settings, etc.)
    },
    changeFrequencies: {
      daily: 'daily' as const,
      weekly: 'weekly' as const,
      monthly: 'monthly' as const,
      yearly: 'yearly' as const,
    },
  },
};

export type SiteConfigType = typeof siteConfig;
