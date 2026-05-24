// Mock product catalog following the strict schema
// { id, type, platform, title, price, stock, details: { age, pvaStatus, flowType, features, successRate, cookiesIncluded, followers } }

export const products = [
  // ============================================================
  // GeeLark RPA Flows
  // ============================================================
  {
    id: 'flow-001',
    type: 'flow',
    platform: 'geelark',
    title: 'Auto-Engage Pro',
    price: 49.99,
    stock: 999,
    details: {
      flowType: 'engagement',
      successRate: 99.8,
      features: ['Auto-like', 'Auto-comment', 'Smart delays', 'Proxy rotation', 'Anti-detection'],
      description: 'Fully automated engagement flow with human-like interaction patterns and smart rate limiting.',
      nodeCount: 24,
      codePreview: `{
  "flow": "auto_engage_v3",
  "nodes": 24,
  "triggers": ["schedule", "webhook"],
  "actions": ["like", "comment", "follow"],
  "delays": { "min": 3, "max": 12 }
}`,
    },
  },
  {
    id: 'flow-002',
    type: 'flow',
    platform: 'geelark',
    title: 'Mass DM Sender',
    price: 79.99,
    stock: 500,
    details: {
      flowType: 'outreach',
      successRate: 97.2,
      features: ['Template engine', 'Spintax support', 'Rate limiting', 'Delivery tracking', 'Warm-up mode'],
      description: 'High-volume direct message automation with customizable templates and intelligent throttling.',
      nodeCount: 31,
      codePreview: `{
  "flow": "mass_dm_v2",
  "nodes": 31,
  "templates": 12,
  "spintax": true,
  "dailyLimit": 200,
  "warmup": { "days": 3, "rampUp": 1.5 }
}`,
    },
  },
  {
    id: 'flow-003',
    type: 'flow',
    platform: 'geelark',
    title: 'Story Viewer Bot',
    price: 29.99,
    stock: 999,
    details: {
      flowType: 'visibility',
      successRate: 99.9,
      features: ['Batch viewing', 'Target lists', 'View analytics', 'Randomized timing'],
      description: 'Automatically view stories of targeted accounts to boost profile visibility and attract organic followers.',
      nodeCount: 16,
      codePreview: `{
  "flow": "story_viewer_v4",
  "nodes": 16,
  "batchSize": 50,
  "viewDelay": { "min": 1, "max": 4 },
  "analytics": true
}`,
    },
  },
  {
    id: 'flow-004',
    type: 'flow',
    platform: 'geelark',
    title: 'Comment Dominator',
    price: 59.99,
    stock: 750,
    details: {
      flowType: 'engagement',
      successRate: 98.5,
      features: ['AI comments', 'Hashtag targeting', 'Competitor scraping', 'Sentiment filter', 'Reply chains'],
      description: 'AI-powered commenting system that generates contextual, human-like comments on targeted posts.',
      nodeCount: 28,
      codePreview: `{
  "flow": "comment_dominator_v2",
  "nodes": 28,
  "aiModel": "gpt-contextual",
  "targeting": ["hashtag", "competitor"],
  "sentiment": "positive",
  "replyDepth": 2
}`,
    },
  },
  {
    id: 'flow-005',
    type: 'flow',
    platform: 'geelark',
    title: 'Follow/Unfollow Engine',
    price: 39.99,
    stock: 999,
    details: {
      flowType: 'growth',
      successRate: 99.1,
      features: ['Smart unfollowing', 'Whitelist', 'Ratio tracking', 'Source targeting', 'Drip mode'],
      description: 'Intelligent follow/unfollow automation with ratio management and engagement-based filtering.',
      nodeCount: 20,
      codePreview: `{
  "flow": "follow_unfollow_v5",
  "nodes": 20,
  "followsPerDay": 150,
  "unfollowAfter": "72h",
  "whitelist": true,
  "ratioTarget": 1.2
}`,
    },
  },
  {
    id: 'flow-006',
    type: 'flow',
    platform: 'geelark',
    title: 'Profile Scraper X',
    price: 89.99,
    stock: 300,
    details: {
      flowType: 'data',
      successRate: 96.7,
      features: ['Bulk extraction', 'Email finder', 'Export CSV/JSON', 'Follower analysis', 'Niche mapping'],
      description: 'Enterprise-grade profile data extraction with contact discovery and export capabilities.',
      nodeCount: 35,
      codePreview: `{
  "flow": "profile_scraper_x",
  "nodes": 35,
  "extract": ["bio", "email", "followers"],
  "export": ["csv", "json"],
  "rateLimit": "conservative",
  "batchSize": 1000
}`,
    },
  },
  {
    id: 'flow-007',
    type: 'flow',
    platform: 'geelark',
    title: 'Account Warmer',
    price: 34.99,
    stock: 999,
    details: {
      flowType: 'maintenance',
      successRate: 99.5,
      features: ['Natural behavior', 'Browse simulation', 'Gradual ramp', 'Device fingerprint', 'Session manager'],
      description: 'Warm up new or aged accounts with natural human-like behavior patterns to avoid detection.',
      nodeCount: 18,
      codePreview: `{
  "flow": "account_warmer_v3",
  "nodes": 18,
  "warmupDays": 7,
  "sessionsPerDay": 4,
  "actions": ["browse", "like", "search"],
  "fingerprint": "randomized"
}`,
    },
  },
  {
    id: 'flow-008',
    type: 'flow',
    platform: 'geelark',
    title: 'Content Auto-Poster',
    price: 69.99,
    stock: 600,
    details: {
      flowType: 'content',
      successRate: 98.9,
      features: ['Queue manager', 'Multi-account', 'Caption AI', 'Hashtag optimizer', 'Best time posting'],
      description: 'Schedule and auto-publish content across multiple accounts with AI-optimized captions.',
      nodeCount: 26,
      codePreview: `{
  "flow": "content_poster_v2",
  "nodes": 26,
  "accounts": "multi",
  "scheduler": "smart",
  "captionAI": true,
  "hashtagOptimizer": { "max": 30, "relevance": 0.85 }
}`,
    },
  },

  // ============================================================
  // Aged Instagram Accounts
  // ============================================================
  {
    id: 'acc-ig-001',
    type: 'account',
    platform: 'instagram',
    title: 'Instagram — Aged 2019 — 12K Followers',
    price: 45.00,
    stock: 8,
    details: {
      age: 2019,
      pvaStatus: true,
      followers: 12400,
      cookiesIncluded: true,
      features: ['Original email', 'Post history', 'Clean record'],
    },
  },
  {
    id: 'acc-ig-002',
    type: 'account',
    platform: 'instagram',
    title: 'Instagram — Aged 2020 — 5K Followers',
    price: 28.00,
    stock: 15,
    details: {
      age: 2020,
      pvaStatus: true,
      followers: 5200,
      cookiesIncluded: true,
      features: ['Phone verified', 'Bio set', 'Avatar uploaded'],
    },
  },
  {
    id: 'acc-ig-003',
    type: 'account',
    platform: 'instagram',
    title: 'Instagram — Aged 2021 — 800 Followers',
    price: 15.00,
    stock: 32,
    details: {
      age: 2021,
      pvaStatus: false,
      followers: 820,
      cookiesIncluded: false,
      features: ['Email verified', 'Profile complete'],
    },
  },
  {
    id: 'acc-ig-004',
    type: 'account',
    platform: 'instagram',
    title: 'Instagram — Aged 2022 — 2K Followers',
    price: 18.00,
    stock: 20,
    details: {
      age: 2022,
      pvaStatus: true,
      followers: 2100,
      cookiesIncluded: true,
      features: ['Phone verified', 'Clean IP history', 'Active status'],
    },
  },

  // ============================================================
  // Aged TikTok Accounts
  // ============================================================
  {
    id: 'acc-tt-001',
    type: 'account',
    platform: 'tiktok',
    title: 'TikTok — Aged 2020 — 25K Followers',
    price: 65.00,
    stock: 5,
    details: {
      age: 2020,
      pvaStatus: true,
      followers: 25300,
      cookiesIncluded: true,
      features: ['Creator fund eligible', 'Live access', 'Post history'],
    },
  },
  {
    id: 'acc-tt-002',
    type: 'account',
    platform: 'tiktok',
    title: 'TikTok — Aged 2021 — 8K Followers',
    price: 35.00,
    stock: 12,
    details: {
      age: 2021,
      pvaStatus: true,
      followers: 8100,
      cookiesIncluded: true,
      features: ['Phone verified', 'Bio link enabled', 'Analytics access'],
    },
  },
  {
    id: 'acc-tt-003',
    type: 'account',
    platform: 'tiktok',
    title: 'TikTok — Aged 2022 — 1.5K Followers',
    price: 12.00,
    stock: 40,
    details: {
      age: 2022,
      pvaStatus: false,
      followers: 1500,
      cookiesIncluded: false,
      features: ['Email verified', 'Profile set up'],
    },
  },
  {
    id: 'acc-tt-004',
    type: 'account',
    platform: 'tiktok',
    title: 'TikTok — Aged 2020 — 50K Followers',
    price: 120.00,
    stock: 2,
    details: {
      age: 2020,
      pvaStatus: true,
      followers: 51200,
      cookiesIncluded: true,
      features: ['Creator fund active', 'Live access', 'Monetization ready', 'Original email'],
    },
  },

  // ============================================================
  // Aged Gmail Accounts
  // ============================================================
  {
    id: 'acc-gm-001',
    type: 'account',
    platform: 'gmail',
    title: 'Gmail — Aged 2018 — PVA',
    price: 8.00,
    stock: 50,
    details: {
      age: 2018,
      pvaStatus: true,
      followers: 0,
      cookiesIncluded: true,
      features: ['Phone verified', 'Recovery set', 'Clean history', 'App passwords enabled'],
    },
  },
  {
    id: 'acc-gm-002',
    type: 'account',
    platform: 'gmail',
    title: 'Gmail — Aged 2019 — PVA',
    price: 6.50,
    stock: 75,
    details: {
      age: 2019,
      pvaStatus: true,
      followers: 0,
      cookiesIncluded: true,
      features: ['Phone verified', 'Google Workspace compatible', 'IMAP enabled'],
    },
  },
  {
    id: 'acc-gm-003',
    type: 'account',
    platform: 'gmail',
    title: 'Gmail — Aged 2020 — No PVA',
    price: 3.50,
    stock: 120,
    details: {
      age: 2020,
      pvaStatus: false,
      followers: 0,
      cookiesIncluded: false,
      features: ['Email verified only', 'Clean IP'],
    },
  },
  {
    id: 'acc-gm-004',
    type: 'account',
    platform: 'gmail',
    title: 'Gmail — Aged 2021 — PVA — Drive Enabled',
    price: 5.00,
    stock: 60,
    details: {
      age: 2021,
      pvaStatus: true,
      followers: 0,
      cookiesIncluded: true,
      features: ['Phone verified', 'Google Drive active', '15GB storage', 'YouTube linked'],
    },
  },
];

export const platforms = [
  { id: 'instagram', label: 'Instagram', color: 'var(--color-instagram)' },
  { id: 'tiktok', label: 'TikTok', color: 'var(--color-tiktok)' },
  { id: 'gmail', label: 'Gmail', color: 'var(--color-gmail)' },
  { id: 'geelark', label: 'GeeLark', color: 'var(--color-geelark)' },
];

export const categories = [
  { id: 'all', label: 'All Assets', icon: '◈' },
  { id: 'flows', label: 'GeeLark Flows', icon: '⚡' },
  {
    id: 'accounts',
    label: 'Aged Accounts',
    icon: '◎',
    children: [
      { id: 'accounts-instagram', label: 'Instagram', icon: '●', platform: 'instagram' },
      { id: 'accounts-tiktok', label: 'TikTok', icon: '▶', platform: 'tiktok' },
      { id: 'accounts-gmail', label: 'Gmail', icon: '✉', platform: 'gmail' },
    ],
  },
];
