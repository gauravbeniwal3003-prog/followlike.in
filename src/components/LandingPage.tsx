import React, { useState } from 'react';
import {
  Globe,
  Sparkles,
  Shield,
  Zap,
  Play,
  Mail,
  Youtube,
  Twitter,
  Instagram,
  ArrowUpRight,
  ChevronRight,
  Eye,
  CheckCircle2,
  Info,
  HelpCircle,
  Clock,
  Layers,
  MessageSquare
} from 'lucide-react';
import { SMMService } from '../types';
import GmailAuthModal from './GmailAuthModal';

interface LandingPageProps {
  onLoginAttempt: () => void;
  servicesCatalog: SMMService[];
  userEmail?: string;
  onLoginSuccess: (session: any) => void;
  landingVideoUrl?: string;
}

export default function LandingPage({
  onLoginAttempt,
  servicesCatalog,
  userEmail,
  onLoginSuccess,
  landingVideoUrl = ''
}: LandingPageProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customFaqAnswer, setCustomFaqAnswer] = useState<string | null>(null);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);

  // Extract unique categories with priority
  const categories = (() => {
    const rawCats = Array.from(new Set(servicesCatalog.map(s => s.category)));
    const priority = ['Instagram', 'YouTube', 'Twitter', 'TikTok'];
    const sorted = [...rawCats].sort((a, b) => {
      const idxA = priority.findIndex(p => a.toLowerCase().includes(p.toLowerCase()));
      const idxB = priority.findIndex(p => b.toLowerCase().includes(p.toLowerCase()));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return ['All', ...sorted];
  })();

  // Filter services
  const filteredServices = servicesCatalog.filter(service => {
    const matchesCategory = activeCategory === 'All' || service.category === activeCategory;
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const specialities = [
    {
      title: 'Multichannel Synergy',
      description: 'Synchronized delivery across Instagram, YouTube, TikTok, Facebook, and X (Twitter) using a single dashboard account.',
      icon: Layers
    },
    {
      title: 'High Retention Delivery',
      description: 'System actions trigger authentic visual watch sessions and interaction weights that bypass strict bot drop metrics.',
      icon: Sparkles
    },
    {
      title: 'Encrypted Panel API',
      description: 'Developer-first integration endpoint equipped with fully complete documentation, ready for automatic reseller syncing.',
      icon: Globe
    }
  ];

  const valueProps = [
    {
      title: 'Ultrafast Onset Speed',
      description: 'Automatic systems initiate orders within 5 to 15 minutes of transaction processing, running round-the-clock.',
      icon: Zap,
    },
    {
      title: 'Lifetime Refill Guard',
      description: 'Many of our services include lifelong refill support. If your follower or like count drops, we will top it back up for free.',
      icon: Shield,
    },
    {
      title: '24/7 WhatsApp Support',
      description: 'Contact our support team directly via WhatsApp anytime. Our helpful team responds quickly to assist you with your orders.',
      icon: Clock,
    }
  ];

  return (
    <div id="landing-root" className="min-h-screen relative overflow-hidden bg-neutral-950 text-white font-sans selection:bg-white selection:text-black">
      {/* Liquid Background Accents */}
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-6 z-10 border-b border-white/5 bg-neutral-950/45 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-black font-black text-xs">SMM</span>
          </div>
          <span className="text-xl font-display font-bold tracking-tighter uppercase">FollowLike Everywhere</span>
        </div>
        <div className="hidden md:flex gap-8 text-xs uppercase tracking-widest font-semibold text-neutral-400">
          <a href="#catalog" className="hover:text-white transition-colors">Services</a>
          <a href="#why-choose-us" className="hover:text-white transition-colors">Uptime & Features</a>
          <a href="#quick-links" className="hover:text-white transition-colors">Support & Rules</a>
        </div>
        <div className="flex items-center gap-4">
          <button 
            id="login-landing-nav"
            onClick={() => setIsGmailModalOpen(true)}
            className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Gmail Sign In
          </button>
        </div>
      </nav>

      {/* Main Viewport Content - Bento Grid Layout */}
      <main className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 p-6 sm:p-8 z-10 relative">
        
        {/* Left 3/5 column: Hero & Immersive Demo Section */}
        <div className="w-full lg:w-3/5 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/40 font-mono">The Future of Distribution</span>
            <h1 className="text-4xl sm:text-6xl font-display font-black leading-[1.0] tracking-tighter">
              FAST & <br/>
              <span className="text-neutral-500 font-extrabold">SOCIAL</span> GROWTH.
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm max-w-md mt-2 leading-relaxed">
              Boost your social presence with fast, secure, and high-retention engagement solutions.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              id="login-landing-hero"
              onClick={() => setIsGmailModalOpen(true)}
              className="px-6 py-3 bg-white text-black text-xs font-bold uppercase tracking-widest rounded-full hover:bg-neutral-200 transition-all"
            >
              Get Started
            </button>
            <a 
              href="#catalog"
              className="px-6 py-3 bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-white/10 transition-all text-center"
            >
              View Services
            </a>
          </div>
        </div>

        {/* Right 2/5 column: Features & High-contrast Speciality */}
        <div className="w-full lg:w-2/5 flex flex-col gap-4 justify-between">
          
          {/* Why Choose FollowLike Everywhere Box */}
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm flex-1 flex flex-col justify-center">
            <h3 className="text-xs font-bold font-mono uppercase tracking-[0.15em] text-white/50 mb-5">Why Us?</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-6 h-6 flex-shrink-0 bg-white/10 border border-white/10 rounded flex items-center justify-center text-[10px] font-mono">01</div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white tracking-tight">Instant Start</p>
                  <p className="text-[11px] text-neutral-400 leading-snug">Automated delivery begins within minutes.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-6 h-6 flex-shrink-0 bg-white/10 border border-white/10 rounded flex items-center justify-center text-[10px] font-mono">02</div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white tracking-tight">Safe & Secure</p>
                  <p className="text-[11px] text-neutral-400 leading-snug">Simulated organic traffic ensures safety.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-6 h-6 flex-shrink-0 bg-white/10 border border-white/10 rounded flex items-center justify-center text-[10px] font-mono">03</div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white tracking-tight">Best Rates</p>
                  <p className="text-[11px] text-neutral-400 leading-snug">Direct provider rates with no middleman fees.</p>
                </div>
              </div>
            </div>
          </div>

          {/* High-Contrast solid white call-to-action block */}
          <div 
            className="bg-white text-black p-6 rounded-3xl flex flex-col justify-between h-48 cursor-pointer hover:bg-neutral-100 transition-all shadow-xl group border border-white"
            onClick={() => setIsGmailModalOpen(true)}
          >
            <div>
              <h3 className="text-black text-xs font-bold uppercase tracking-wider mb-2 font-mono">Our Speciality</h3>
              <p className="text-neutral-700 text-xs font-medium leading-relaxed font-sans">
                We specialize in high-retention audience building and automated engagement workflows that feel 100% organic and non-drop.
              </p>
            </div>
            <div className="flex justify-between items-end">
              <div className="text-black">
                <div className="text-3xl font-black font-display tracking-tight">12M+</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Orders Served</div>
              </div>
              <button className="w-10 h-10 bg-black rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Featured Deals Section */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 pb-16 relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-mono uppercase tracking-widest text-emerald-400 font-bold">Featured Deals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['view', 'follower', 'like'].map(type => {
            const match = servicesCatalog
              .filter(s => s.category.toLowerCase().includes('instagram') && s.name.toLowerCase().includes(type))
              .sort((a,b) => a.ratePer1000 - b.ratePer1000)[0];
            
            if (!match) return null;
            
            return (
              <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setIsGmailModalOpen(true)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded font-mono border border-emerald-500/30">
                    Cheapest {type}s
                  </div>
                  <Instagram className="w-5 h-5 text-neutral-400" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2 line-clamp-2">{match.name}</h3>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-white font-display">₹{match.ratePer1000.toFixed(2)}</span>
                  <span className="text-[10px] text-neutral-500 font-mono mb-1 uppercase">/ 1000</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="why-choose-us" className="py-16 border-t border-white/5 bg-neutral-950/40 relative z-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* side info */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-mono text-neutral-500 tracking-widest uppercase">Verified Benchmark</span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white/95">Why FollowLike Everywhere?</h2>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                We use simulated viewer contexts across secure proxy grids, ensuring absolute safety for your channels.
              </p>

              <div className="space-y-2 pt-2 text-xs">
                <div className="flex items-start gap-2 text-neutral-300">
                  <CheckCircle2 className="w-4 h-4 text-white mt-0.5 shrink-0" />
                  <span>Absolute SSL checkout and secure balance ledger.</span>
                </div>
                <div className="flex items-start gap-2 text-neutral-300">
                  <CheckCircle2 className="w-4 h-4 text-white mt-0.5 shrink-0" />
                  <span>0% drop risk on lifelong refilled campaigns.</span>
                </div>
                <div className="flex items-start gap-2 text-neutral-300">
                  <CheckCircle2 className="w-4 h-4 text-white mt-0.5 shrink-0" />
                  <span>Fully structured API docs for direct operations.</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="whychoose-cta"
                  onClick={() => setIsGmailModalOpen(true)}
                  className="px-6 py-2 rounded-lg text-xs font-bold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer"
                >
                  Create Account Now
                </button>
              </div>
            </div>

            {/* Right side stats bento structure */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {valueProps.map((value, i) => {
                const IconComp = value.icon;
                return (
                  <div key={i} className="rounded-2xl p-5 border border-white/5 bg-neutral-900/50 hover:border-white/20 transition-all flex flex-col justify-between h-[160px]">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{value.title}</h4>
                      <p className="mt-1 text-[11px] text-neutral-400 leading-snug">{value.description}</p>
                    </div>
                  </div>
                );
              })}

              {/* Extra banner block spanning 3 columns on sm screens */}
              <div className="sm:col-span-3 rounded-2xl p-5 border border-white/5 bg-neutral-900/20 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <h4 className="text-xs sm:text-sm font-bold text-white">Need Custom High-Volume Service Plans?</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Place large bulk orders easily in our dashboard or contact our customer support team.</p>
                </div>
                <button
                  id="bento-support-link"
                  onClick={() => {
                    setIsGmailModalOpen(true);
                  }}
                  className="px-4 py-1.5 rounded-lg text-[10px] tracking-wider uppercase font-bold bg-white/10 border border-white/10 hover:bg-white/20 text-white whitespace-nowrap transition-all"
                >
                  Contact Support
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Accordion FAQ / Knowledge segment */}
      <section className="py-20 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Frequently Asked Inquiries</h2>
            <p className="mt-2 text-xs sm:text-sm text-neutral-400">Quick guides regarding execution speed, warranty refills and transaction status.</p>
          </div>

          <div className="space-y-3">
          {[
            {
              q: 'What is FollowLike Everywhere, and are these metrics verified?',
              a: 'FollowLike Everywhere is an advanced social media marketing interface that delivers custom engagement loops (views, follows, subscribers) to accounts. These actions are triggered via premium dedicated developer proxy grids to maintain absolute security.'
            },
            {
              q: 'Can these services lead to page suspension?',
              a: 'Never. Our special high retention delivery speed algorithm spaces actions naturally so they closely replicate normal organic community traffic.'
            },
            {
              q: 'How does the Google login save my progress?',
              a: 'Your session token is generated through secure Google Auth protocol and persistent storage keys. This allows you to close the interface, return subsequently, and retain all ledger credits and order statuses perfectly.'
            }
          ].map((faq, idx) => (
              <div key={idx} className="rounded-lg border border-white/5 bg-black overflow-hidden transition-all duration-200">
                <button
                  id={`faq-toggle-${idx}`}
                  onClick={() => setCustomFaqAnswer(customFaqAnswer === idx.toString() ? null : idx.toString())}
                  className="w-full p-4 text-left flex items-center justify-between text-xs sm:text-sm font-semibold hover:bg-white/[0.02]"
                >
                  <span className="font-medium text-white">{faq.q}</span>
                  <span className="text-neutral-400 font-bold ml-2 text-xs">{customFaqAnswer === idx.toString() ? '−' : '+'}</span>
                </button>
                {customFaqAnswer === idx.toString() && (
                  <div className="p-4 border-t border-white/[0.05] text-xs text-neutral-400 leading-relaxed bg-white/[0.01]">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUICK LINKS SECTION (Refund layout, Support, Socials, Mail) */}
      <footer id="quick-links" className="border-t border-white/[0.06] bg-black pt-16 pb-8 text-neutral-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            
            {/* Column 1 - Logo & Intro */}
            <div className="md:col-span-4 space-y-4">
              <div className="flex items-center space-x-3 text-white">
                <div className="w-6 h-6 rounded bg-white flex items-center justify-center font-bold text-black text-xs">
                  S
                </div>
                <span className="text-base font-semibold tracking-tight uppercase">FollowLike Everywhere</span>
              </div>
              <p className="text-neutral-500 leading-relaxed font-sans max-w-sm">
                Next-generation monochrome social booster application, empowering visual marketing experts since 2026. Handcrafted for maximum throughput.
              </p>
              
              <div className="text-[11px] font-mono text-neutral-600">
                System Time: 2026-06-22 08:10:08 UTC
              </div>
            </div>

            {/* Column 2 - Refund Policy (NO REFUND strictly requested by user) */}
            <div className="md:col-span-5 space-y-3">
              <h4 className="text-xs font-semibold tracking-widest text-white uppercase flex items-center">
                Refunds
              </h4>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-[11px] leading-relaxed text-neutral-400">
                <span className="text-white font-semibold">STRICT: NO REFUNDS.</span> All transactions are final. Once an order is queued, it cannot be recalled.
              </div>
            </div>

            {/* Column 3 - Fast Contact & Handles */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-semibold tracking-widest text-white uppercase">Client Channels</h4>
              
              <ul className="space-y-2 text-[11px]">
                <li>
                  <a href="mailto:support@followlike.in" className="flex items-center hover:text-white transition-colors group">
                    <Mail className="w-3.5 h-3.5 mr-2 text-neutral-500 group-hover:text-white" />
                    support@followlike.in
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/918168285559" target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-white transition-colors group">
                    <MessageSquare className="w-3.5 h-3.5 mr-2 text-neutral-500 group-hover:text-white" />
                    24/7 WhatsApp Support
                  </a>
                </li>
              </ul>

              {/* Social Media Handles */}
              <div className="pt-2">
                <p className="text-[10px] font-medium text-neutral-500 uppercase mb-2">Connect globally</p>
                <div className="flex gap-2">
                  <a id="social-handle-youtube" href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="p-2 border border-white/10 rounded-lg hover:bg-white hover:text-black hover:border-white transition-all text-neutral-400">
                    <Youtube className="w-4 h-4" />
                  </a>
                  <a id="social-handle-twitter" href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 border border-white/10 rounded-lg hover:bg-white hover:text-black hover:border-white transition-all text-neutral-400">
                    <Twitter className="w-4 h-4" />
                  </a>
                  <a id="social-handle-instagram" href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-2 border border-white/10 rounded-lg hover:bg-white hover:text-black hover:border-white transition-all text-neutral-400">
                    <Instagram className="w-4 h-4" />
                  </a>
                  <button id="social-handle-telegram" onClick={() => setIsGmailModalOpen(true)} className="p-2 border border-white/10 rounded-lg hover:bg-white hover:text-black hover:border-white transition-all text-neutral-400">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-500">
            <div>
              © 2026 FollowLike Everywhere Panel Corporation. All rights reserved.
            </div>
            <div className="flex space-x-4">
              <span className="hover:text-white cursor-pointer" onClick={() => setIsGmailModalOpen(true)}>Terms of Service</span>
              <span className="hover:text-white cursor-pointer" onClick={() => setIsGmailModalOpen(true)}>Privacy Policy</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Gmail auth Modal */}
      <GmailAuthModal
        isOpen={isGmailModalOpen}
        onClose={() => setIsGmailModalOpen(false)}
        onSuccess={(session) => {
          setIsGmailModalOpen(false);
          onLoginSuccess(session);
        }}
        userEmail={userEmail}
      />
    </div>
  );
}
