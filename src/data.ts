import { SMMService, SMMOrder, SupportTicket } from './types';

export const INITIAL_SERVICES: SMMService[] = [
  // Instagram
  {
    id: 'ig-1',
    category: 'Instagram',
    name: 'Instagram Followers [Real / High Quality / No Drop]',
    ratePer1000: 2.80,
    min: 100,
    max: 50000,
    description: '🌐 High quality real look followers. No drop guarantee. Speed: 5k-10k per day. Perfect for amplifying account credibility.'
  },
  {
    id: 'ig-2',
    category: 'Instagram',
    name: 'Instagram Likes [Instant / Non-Drop / Max 100k]',
    ratePer1000: 0.90,
    min: 50,
    max: 100000,
    description: '⚡ Super fast delivery within 5-15 minutes after ordering. Lifetime refill guarantee. High-quality accounts only.'
  },
  {
    id: 'ig-3',
    category: 'Instagram',
    name: 'Instagram Custom Comments [English / Positive]',
    ratePer1000: 4.50,
    min: 10,
    max: 2000,
    description: '💬 Custom or generic topic-relevant comments from active looking profiles. Boosts post engagement and reaches more discovery feeds.'
  },
  {
    id: 'ig-4',
    category: 'Instagram',
    name: 'Instagram Reels Views [Super Viral Speed / Instant]',
    ratePer1000: 0.12,
    min: 500,
    max: 10000000,
    description: '🎬 High retention view burst for Reels. Instant launch. Speed: Up to 1M daily. Great for pushing content into algorithms.'
  },

  // YouTube
  {
    id: 'yt-1',
    category: 'YouTube',
    name: 'YouTube High Retention Views [Suggested & Search / No Drop]',
    ratePer1000: 3.40,
    min: 500,
    max: 500000,
    description: '📊 High retention (3 - 5 min watch duration). Geolas: Worldwide. Helps rank search queries and recommended feeds natively.'
  },
  {
    id: 'yt-2',
    category: 'YouTube',
    name: 'YouTube Subscribers [Non-Drop / Lifetime Refill / Speed 500/day]',
    ratePer1000: 14.20,
    min: 100,
    max: 20000,
    description: '🔴 Permanent subscribers from real authenticated Google accounts. 0% drops. Refill covered forever.'
  },
  {
    id: 'yt-3',
    category: 'YouTube',
    name: 'YouTube Video Likes [Instant / Safe / Lifetime covered]',
    ratePer1000: 2.10,
    min: 100,
    max: 50000,
    description: '👍 Add natural likes to your video. Speed: 1k per hour. Built on active Google account patterns for organic growth.'
  },
  {
    id: 'yt-4',
    category: 'YouTube',
    name: 'YouTube Watch Hours [Organic Session / 1hr+ video required]',
    ratePer1000: 19.50,
    min: 100,
    max: 4000,
    description: '⏱ Accumulates authentic watch duration to safely meet the 4k partner program quota. Requires at least 1 video of 60+ minutes.'
  },

  // TikTok
  {
    id: 'tk-1',
    category: 'TikTok',
    name: 'TikTok Followers [Active Accounts / Multi-Region]',
    ratePer1000: 1.95,
    min: 100,
    max: 100000,
    description: '🎵 Fast-start TikTok followers. Balanced profiles with bios, videos and post history to ensure algorithmic protection.'
  },
  {
    id: 'tk-2',
    category: 'TikTok',
    name: 'TikTok Likes [Instant Launch / No Refill needed]',
    ratePer1000: 0.95,
    min: 100,
    max: 500000,
    description: '❤️ Speed: Up to 50k likes per day. High density distribution to support viral TikTok post trends.'
  },
  {
    id: 'tk-3',
    category: 'TikTok',
    name: 'TikTok Video Views [High Retention / Instant]',
    ratePer1000: 0.04,
    min: 1000,
    max: 100000000,
    description: '🚀 Watch duration 90-100%. Accelerates engagement metrics so your TikTok video reaches the For You Page (FYP).'
  },

  // X / Twitter
  {
    id: 'tw-1',
    category: 'Twitter (X)',
    name: 'X (Twitter) NFT & Crypto Active Followers',
    ratePer1000: 8.50,
    min: 50,
    max: 25000,
    description: '🐦 High tier web3/crypto-oriented followers or general active looking accounts. Ideal for establishing crypto community weight.'
  },
  {
    id: 'tw-2',
    category: 'Twitter (X)',
    name: 'X (Twitter) Retweets & Reposts [Organic Speed]',
    ratePer1000: 4.80,
    min: 50,
    max: 10000,
    description: '🔄 Reposts with instant onset. Simulates steady organic distribution so the content matches global X feeds.'
  },

  // Facebook
  {
    id: 'fb-1',
    category: 'Facebook',
    name: 'Facebook Page Likes + Followers [Full Profile Quality]',
    ratePer1000: 5.20,
    min: 100,
    max: 100000,
    description: '👍 Professional profile likes + follows to level up your brand value and business page trust rating.'
  },
  {
    id: 'fb-2',
    category: 'Facebook',
    name: 'Facebook Post Post-Group Likes [Organic Spread]',
    ratePer1000: 1.60,
    min: 100,
    max: 50000,
    description: '📣 Boost post confidence with steady post likes. Safe with algorithm criteria.'
  }
];

export const INITIAL_ORDERS: SMMOrder[] = [
  {
    id: 'ORD-8947',
    serviceId: 'yt-1',
    serviceName: 'YouTube High Retention Views [Suggested & Search / No Drop]',
    category: 'YouTube',
    targetUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    quantity: 1000,
    charge: 3.40,
    status: 'Completed',
    createdAt: '2026-06-20T14:32:00Z'
  },
  {
    id: 'ORD-8912',
    serviceId: 'ig-2',
    serviceName: 'Instagram Likes [Instant / Non-Drop / Max 100k]',
    category: 'Instagram',
    targetUrl: 'https://instagram.com/p/C3a_82LsKpq',
    quantity: 2500,
    charge: 2.25,
    status: 'In Progress',
    createdAt: '2026-06-21T09:12:00Z'
  }
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'TCK-2309',
    subject: 'Request for special custom SMM package',
    message: 'Hello, do you offer customized YouTube watch hours split across multiple channels? Thank you.',
    status: 'Answered',
    replies: [
      {
        id: 'rep-1',
        sender: 'support',
        message: 'Hello there! Yes, we can custom-configure split campaigns. Please let us know the channel links and specific distribution speed you prefer in a reply, and we will set up a custom rate for you!',
        createdAt: '2026-06-21T18:45:00Z'
      }
    ],
    createdAt: '2026-06-21T16:00:00Z'
  }
];

export const MOCK_EMAILS = [
  'gauravbeniwal30003@gmail.com',
  'demo.user@gmail.com',
  'growth.expert@gmail.com',
  'agency.social@gmail.com'
];
