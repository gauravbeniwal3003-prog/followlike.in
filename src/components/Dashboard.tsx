import { API_BASE } from '../config';
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  User,
  DollarSign,
  PlusCircle,
  Clock,
  Globe,
  Plus,
  Send,
  Link,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy,
  LogOut,
  ChevronRight,
  LifeBuoy,
  FileCode,
  Shield,
  Zap,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Menu,
  X,
  MessageSquare,
  ChevronDown,
  Check,
  Pin
} from 'lucide-react';
import { SMMService, SMMOrder, Transaction, UserSession } from '../types';
import { 
  syncUserProfile, 
  updateDbBalance, 
  getDbOrders, 
  createDbOrder, 
  logDbTransaction, 
  getDbTransactions,
  DATABASE_SQL_INSTRUCTIONS,
  supabase
} from '../lib/supabase';

interface DashboardProps {
  session: UserSession;
  onLogout: () => void;
  servicesCatalog: SMMService[];
  globalSettings: { landing_video_url: string; profit_markup_percent: number };
  onUpdateSettings: (newSett: { landing_video_url: string; profit_markup_percent: number }) => void;
  refreshServices: (forceSync?: boolean) => Promise<boolean>;
  refreshingServices: boolean;
}

const renderDescription = (desc: string) => {
  if (!desc) return 'Fast and guaranteed delivery service. Speeds may vary slightly depending on current order traffic.';
  
  // Detect if description is HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(desc);
  
  if (isHtml) {
    // Process HTML to clean up style attributes that clash with dark theme
    let cleaned = desc
      .replace(/color\s*:[^;]+;/gi, '') // Remove inline colors
      .replace(/background-color\s*:[^;]+;/gi, '') // Remove inline background-colors
      .replace(/background\s*:[^;]+;/gi, '') // Remove inline backgrounds
      .replace(/border-bottom:\s*1px\s*solid\s*#eee/gi, 'border-bottom: 1px solid rgba(255,255,255,0.08)')
      .replace(/border-right:\s*1px\s*solid\s*#eee/gi, 'border-right: 1px solid rgba(255,255,255,0.08)')
      .replace(/border:\s*1px\s*solid\s*#eee/gi, 'border: 1px solid rgba(255,255,255,0.08)');

    return (
      <div 
        className="smm-html-desc text-xs text-neutral-300 leading-normal"
        dangerouslySetInnerHTML={{ __html: cleaned }}
      />
    );
  }
  
  return <div className="whitespace-pre-wrap">{desc}</div>;
};

export default function Dashboard({
  session,
  onLogout,
  servicesCatalog,
  globalSettings,
  onUpdateSettings,
  refreshServices,
  refreshingServices
}: DashboardProps) {
  // Navigation Tabs state including 'admin'
  const [activeTab, _setActiveTab] = useState<'home' | 'new-order' | 'orders' | 'services' | 'funds' | 'profile' | 'support' | 'menu' | 'admin'>('home');
  
  const navigate = useNavigate();
  const location = useLocation();

  const setActiveTab = (tab: 'home' | 'new-order' | 'orders' | 'services' | 'funds' | 'profile' | 'support' | 'menu' | 'admin') => {
    if (isPlacingOrder) {
      console.warn('Navigation blocked during active SMM order placement.');
      return;
    }
    setIsMobileMenuOpen(false);
    if (tab === 'menu' || tab === 'admin') {
      _setActiveTab(tab);
    } else {
      navigate('/' + tab);
    }
  };

  // Sync activeTab with pathname on mount and pathname change
  useEffect(() => {
    if (isPlacingOrder) return;
    const path = location.pathname;
    if (path === '/home') {
      _setActiveTab('home');
    } else if (path === '/new-order') {
      _setActiveTab('new-order');
    } else if (path === '/orders') {
      _setActiveTab('orders');
    } else if (path === '/services') {
      _setActiveTab('services');
    } else if (path === '/funds') {
      _setActiveTab('funds');
    } else if (path === '/profile') {
      _setActiveTab('profile');
    } else if (path === '/support') {
      _setActiveTab('support');
    } else if (path === '/admin') {
      _setActiveTab('admin');
    } else if (path === '/') {
      _setActiveTab('home');
    }
  }, [location.pathname]);

  // Scroll to top whenever pathname or activeTab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, activeTab]);
  
  // Mobile Sidebar switcher state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // User Supabase & Local state hooks
  const [orders, setOrders] = useState<SMMOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(session.balance);
  const [apiKey, setApiKey] = useState<string>(session.apiKey || 'smm_KEY847294JSKDS9');
  const [userProfilePic] = useState<string>(session.picture || 'https://api.dicebear.com/7.x/initials/svg?seed=User&backgroundColor=000000');
  const [loadingDb, setLoadingDb] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [timeString, setTimeString] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('en-IN', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // New Orders and search state
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('ALL');
  const [newOrderSearchQuery, setNewOrderSearchQuery] = useState<string>('');

  // Input states
  // 1. New Order Form
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1000);
  const [calcCharge, setCalcCharge] = useState<number>(0);
  const [orderNotification, setOrderNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Order placement state
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState<{
    orderId: string;
    providerOrderId: string;
    serviceName: string;
    quantity: number;
    charge: number;
    timestamp: string;
  } | null>(null);
  const [orderErrorDetails, setOrderErrorDetails] = useState<string | null>(null);

  // Custom dropdown states for Category & Service selector in New Order Form
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState<boolean>(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');

  // 2. Services search & filter
  const [servicesSearch, setServicesSearch] = useState<string>('');
  const [servicesFilterPlatform, setServicesFilterPlatform] = useState<string>('All');

  // Group services by category and filter by platform
  const filteredAndGroupedServices = (() => {
    let filtered = servicesCatalog.filter(service => {
      const matchesPlatform = servicesFilterPlatform === 'All' || 
                              service.category.toLowerCase().includes(servicesFilterPlatform.toLowerCase());
      const matchesKeyword = service.name.toLowerCase().includes(servicesSearch.toLowerCase()) || 
                             (service.description && service.description.toLowerCase().includes(servicesSearch.toLowerCase()));
      return matchesPlatform && matchesKeyword;
    });

    const grouped: Record<string, SMMService[]> = {};
    
    // Sort services by their category order first
    filtered.sort((a, b) => {
        const catOrderA = (a.categorySortOrder !== undefined && a.categorySortOrder !== null) ? Number(a.categorySortOrder) : 99999;
        const catOrderB = (b.categorySortOrder !== undefined && b.categorySortOrder !== null) ? Number(b.categorySortOrder) : 99999;
        
        if (catOrderA === 0 && catOrderB === 0) return a.category.localeCompare(b.category);
        if (catOrderA === 0) return 1;
        if (catOrderB === 0) return -1;
        
        if (catOrderA !== catOrderB) return catOrderA - catOrderB;
        return a.category.localeCompare(b.category);
    });

    for (const service of filtered) {
      if (!grouped[service.category]) grouped[service.category] = [];
      grouped[service.category].push(service);
    }
    
    return grouped;
  })();

  const platforms = ['All', 'Instagram', 'YouTube', 'TikTok', 'Twitter', 'Facebook'];
  
  // 3. Add Funds
  const [paymentMethod, setPaymentMethod] = useState<string>('Razorpay Netbanking');
  const [paymentAmount, setPaymentAmount] = useState<number>(500);
  const [fundsNotification, setFundsNotification] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_percent: number } | null>(null);
  const [couponValidationNotice, setCouponValidationNotice] = useState<string | null>(null);

  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // 5. Automated SMM API Sync
  const [syncingStatus, setSyncingStatus] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // 6. Admin Panel States and Actions
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'settings' | 'coupons' | 'transactions'>('users');
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminCoupons, setAdminCoupons] = useState<any[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<any[]>([]);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);

  // New Coupon inputs
  const [newCouponCode, setNewCouponCode] = useState<string>('');
  const [newCouponDiscount, setNewCouponDiscount] = useState<number>(10);
  const [newCouponExpiry, setNewCouponExpiry] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [newCouponMaxUses, setNewCouponMaxUses] = useState<number>(100);

  // Global tunable states
  const [editMarkup, setEditMarkup] = useState<number>(globalSettings.profit_markup_percent);
  const [editVideoUrl, setEditVideoUrl] = useState<string>(globalSettings.landing_video_url);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  // Sync state if prop changes
  useEffect(() => {
    setEditMarkup(globalSettings.profit_markup_percent);
    setEditVideoUrl(globalSettings.landing_video_url);
  }, [globalSettings]);

  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      // Fetch users
      const usersRes = await fetch(`${API_BASE}/api/smm/admin/users`);
      const usersData = await usersRes.json();
      if (usersData && usersData.success) {
        setAdminUsers(usersData.users);
      }

      // Fetch coupons
      const couponsRes = await fetch(`${API_BASE}/api/smm/coupons`);
      const couponsData = await couponsRes.json();
      if (couponsData && couponsData.success) {
        setAdminCoupons(couponsData.coupons);
      }

      // Fetch transactions
      const txRes = await fetch(`${API_BASE}/api/smm/admin/transactions`);
      const txData = await txRes.json();
      if (txData && txData.success) {
        setAdminTransactions(txData.transactions);
      }

      // Fetch orders
      const ordersRes = await fetch(`${API_BASE}/api/smm/admin/orders`);
      const ordersData = await ordersRes.json();
      if (ordersData && ordersData.success) {
        setAdminOrders(ordersData.orders);
      }
    } catch (err) {
      console.error('Failed fetching admin data:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAdminData();
    }
  }, [activeTab]);

  const handleChangeBalance = async (email: string, amountStr: string) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return;
    try {
      const res = await fetch(`${API_BASE}/api/smm/admin/users/update-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, balance: amount })
      });
      const data = await res.json();
      if (data && data.success) {
        setAdminUsers(prev => prev.map(u => u.email === email ? { ...u, balance: amount } : u));
        if (email === session.email) {
          setCurrentBalance(amount);
          await saveBalanceToStorage(amount);
        }
      }
    } catch (err) {
      console.error('Balance update error:', err);
    }
  };

  const handleToggleAdminStatus = async (email: string, currentVal: boolean) => {
    const newVal = !currentVal;
    try {
      const res = await fetch(`${API_BASE}/api/smm/admin/users/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, is_admin: newVal })
      });
      const data = await res.json();
      if (data && data.success) {
        setAdminUsers(prev => prev.map(u => u.email === email ? { ...u, is_admin: newVal } : u));
      }
    } catch (err) {
      console.error('Admin toggling error:', err);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/smm/coupons/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCouponCode,
          discount_percent: newCouponDiscount,
          expires_at: new Date(newCouponExpiry).toISOString(),
          max_uses: newCouponMaxUses
        })
      });
      const data = await res.json();
      if (data && data.success) {
        setNewCouponCode('');
        fetchAdminData();
      }
    } catch (err) {
      console.error('Error creating coupon:', err);
    }
  };

  const handleDeleteCoupon = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/smm/coupons/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data && data.success) {
        setAdminCoupons(prev => prev.filter(c => c.code !== code));
      }
    } catch (err) {
      console.error('Coupon deletion error:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus('Saving settings update...');
    try {
      const res = await fetch(`${API_BASE}/api/smm/settings/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profit_markup_percent: editMarkup,
          landing_video_url: editVideoUrl
        })
      });
      const data = await res.json();
      if (data && data.success) {
        onUpdateSettings({
          profit_markup_percent: editMarkup,
          landing_video_url: editVideoUrl
        });
        setSettingsStatus('Settings synced and saved globally!');
      } else {
        setSettingsStatus('Failed: ' + (data.error || 'unknown issue'));
      }
    } catch (err: any) {
      setSettingsStatus('Connection failed: ' + err.message);
    }
    setTimeout(() => setSettingsStatus(null), 5000);
  };

  // Convert service contract values to INR
  const getInrRate = (service: SMMService) => {
    if (!service) return 0;
    // If service.id doesn't contain standard hyphens, it is a live API service (already processed in INR!)
    if (!service.id.includes('-')) {
      return service.ratePer1000;
    }
    return Math.round(service.ratePer1000 * 80); // Legacy mock scaling
  };

  // Asynchronously load durable data from Supabase
  const loadSupabaseData = async () => {
    setLoadingDb(true);
    setDbError(null);
    try {
      // 1. Sync & fetch profile
      const userProfile = await syncUserProfile(session.email, session.name);
      setCurrentBalance(userProfile.balance);
      if (userProfile.apiKey) {
        setApiKey(userProfile.apiKey);
      }

      // 2. Fetch orders
      const dbOrders = await getDbOrders(session.email);
      setOrders(dbOrders || []);

      // 3. Fetch transactions
      const dbTx = await getDbTransactions(session.email);
      setTransactions(dbTx || []);
    } catch (err: any) {
      console.error('Supabase fetch failed:', err);
      setDbError(err?.message || 'Database synchronization offline');
      setOrders([]);
      setTransactions([]);
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    loadSupabaseData();
  }, [session.email]);

  // Real-time connections to keep balance, orders, and transactions always up-to-date
  useEffect(() => {
    if (!session.email) return;

    console.log('[Realtime] Subscribing to database channels for', session.email);

    const channel = supabase
      .channel(`user-realtime-channel-${session.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `email=eq.${session.email}`
        },
        (payload: any) => {
          console.log('[Realtime] Profile change detected:', payload);
          if (payload.new && typeof payload.new.balance !== 'undefined') {
            const newBal = parseFloat(payload.new.balance);
            setCurrentBalance(newBal);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_email=eq.${session.email}`
        },
        (payload: any) => {
          console.log('[Realtime] Order change detected:', payload);
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            const newOrder: SMMOrder = {
              id: row.id,
              serviceId: row.service_id || '',
              serviceName: row.service_name || `Service #${row.service_id || ''}`,
              category: row.category || 'General',
              targetUrl: row.target_url || row.link || '',
              quantity: row.quantity,
              charge: parseFloat(row.charge),
              status: row.status as any,
              createdAt: row.created_at,
              providerOrderId: row.provider_order_id
            };
            setOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            const updatedOrder: Partial<SMMOrder> = {
              serviceId: row.service_id,
              serviceName: row.service_name,
              category: row.category,
              targetUrl: row.target_url || row.link,
              quantity: row.quantity,
              charge: row.charge ? parseFloat(row.charge) : undefined,
              status: row.status as any,
              providerOrderId: row.provider_order_id
            };
            setOrders((prev) =>
              prev.map((o) =>
                o.id === row.id ? ({ ...o, ...updatedOrder } as SMMOrder) : o
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old;
            setOrders((prev) => prev.filter((o) => o.id !== row.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_email=eq.${session.email}`
        },
        (payload: any) => {
          console.log('[Realtime] Transaction change detected:', payload);
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            const newTx: Transaction = {
              id: row.id,
              amount: parseFloat(row.amount),
              method: row.method,
              status: row.status as any,
              createdAt: row.created_at
            };
            setTransactions((prev) => {
              if (prev.some((t) => t.id === newTx.id)) return prev;
              return [newTx, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            const updatedTx: Partial<Transaction> = {
              amount: row.amount ? parseFloat(row.amount) : undefined,
              method: row.method,
              status: row.status as any,
              createdAt: row.created_at
            };
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === row.id ? ({ ...t, ...updatedTx } as Transaction) : t
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old;
            setTransactions((prev) => prev.filter((t) => t.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[Realtime] Cleaning up real-time subscription for', session.email);
      supabase.removeChannel(channel);
    };
  }, [session.email]);

  // Persist states to database
  const saveOrdersToStorage = async (newOrders: SMMOrder[]) => {
    setOrders(newOrders);
  };

  const saveBalanceToStorage = async (newBal: number) => {
    setCurrentBalance(newBal);
    await updateDbBalance(session.email, newBal);
  };

  // Sync active orders automatically with Social Up Hub API and issue refunds for cancellations
  const syncActiveOrdersStatus = async (silent = false) => {
    if (syncingStatus) return;
    if (!silent) setSyncingStatus(true);
    if (!silent) setSyncNotice(null);

    // Sync only orders which have a provider reference and are not completed/cancelled yet
    const targetOrders = orders.filter(
      (o) => o.providerOrderId && (o.status === 'Pending' || o.status === 'In Progress')
    );

    if (targetOrders.length === 0) {
      if (!silent) {
        setSyncingStatus(false);
        setSyncNotice("All orders are completed or no active live queues exist.");
        setTimeout(() => setSyncNotice(null), 3000);
      }
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/smm/status-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: targetOrders })
      });

      const data = await response.json();
      if (data && data.success && Array.isArray(data.updatedOrders)) {
        let changedCount = 0;
        let refundSum = 0;
        const refundDetails: string[] = [];
        let newBalance = currentBalance;

        // Clone orders to apply changes
        const ordersCopy = [...orders];

        for (const update of data.updatedOrders) {
          const idx = ordersCopy.findIndex((o) => o.id === update.id);
          if (idx !== -1) {
            const currentItem = ordersCopy[idx];
            if (currentItem.status !== update.status) {
              ordersCopy[idx] = {
                ...currentItem,
                status: update.status
              };
              changedCount++;

              // Commit new status directly inside database
              try {
                await supabase.from('orders').update({ status: update.status }).eq('id', currentItem.id);
              } catch (dbErr) {
                console.error("Supabase order status sync fail:", dbErr);
              }

              // Handle full automatic refund for newly canceled/failed orders
              if (update.refundIssued) {
                const refundValue = parseFloat(update.refundAmount || currentItem.charge);
                refundSum += refundValue;
                refundDetails.push(`${currentItem.id} (+₹${refundValue})`);

                // Insert refund transaction log
                const refundTxId = 'TXN-REF' + Math.floor(100000 + Math.random() * 900000);
                const refundTx: Transaction = {
                  id: refundTxId,
                  amount: refundValue,
                  method: 'Cancellation Refund',
                  status: 'Success',
                  createdAt: new Date().toISOString()
                };
                try {
                  await logDbTransaction(session.email, refundTx);
                  setTransactions((prev) => [refundTx, ...prev]);
                } catch (txErr) {
                  console.error("Refund transaction write fail:", txErr);
                }
              }
            }
          }
        }

        if (changedCount > 0) {
          await saveOrdersToStorage(ordersCopy);

          if (refundSum > 0) {
            const finalBal = newBalance + refundSum;
            await saveBalanceToStorage(finalBal);
            setSyncNotice(`Synced: SMM update successful. Cancelled lines refunded: ${refundDetails.join(', ')}.`);
          } else {
            setSyncNotice(`Synced: ${changedCount} SMM delivery pipelines updated.`);
          }
        } else {
          if (!silent) setSyncNotice("Synced! No state upgrades reported from the SMM gateway yet.");
        }
      } else {
        throw new Error(data.error || 'Gateway returned invalid sync status.');
      }
    } catch (err: any) {
      console.warn("SMM Status Sync Error:", err);
      if (!silent) setSyncNotice(`Status sync unavailable: ${err.message || 'connection gateway rate limit'}`);
    } finally {
      if (!silent) setSyncingStatus(false);
      setTimeout(() => setSyncNotice(null), 5000);
    }
  };

  // Automated background polling trigger for active queues
  useEffect(() => {
    const hasActiveOrders = orders.some(
      (o) => o.providerOrderId && (o.status === 'Pending' || o.status === 'In Progress')
    );

    if (orders.length > 0) {
      // Auto pulse sync 2 seconds after dashboard is loaded
      const startupTimer = setTimeout(() => {
        syncActiveOrdersStatus(true);
      }, 2000);

      // Periodic check: use a fast 5 seconds interval if there are active orders to search for their status
      const intervalTime = hasActiveOrders ? 5000 : 25000;
      const statusInterval = setInterval(() => {
        syncActiveOrdersStatus(true);
      }, intervalTime);

      return () => {
        clearTimeout(startupTimer);
        clearInterval(statusInterval);
      };
    }
  }, [orders]);

  // Get unique categories for menus, sorted by database categorySortOrder
  const categories = (() => {
    const catMap = new Map<string, number>();
    servicesCatalog.forEach(s => {
      const order = s.categorySortOrder !== undefined && s.categorySortOrder !== null
        ? Number(s.categorySortOrder)
        : 99999;
      if (!catMap.has(s.category) || order < catMap.get(s.category)!) {
        catMap.set(s.category, order);
      }
    });
    
    return Array.from(catMap.entries())
      .sort((a, b) => {
        const orderA = Number(a[1]);
        const orderB = Number(b[1]);
        
        if (orderA === 0 && orderB === 0) return a[0].localeCompare(b[0]);
        if (orderA === 0) return 1;
        if (orderB === 0) return -1;
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(entry => entry[0]);
  })();

  // Filter categories based on selectedPlatform
  const filteredCategories = (() => {
    if (!selectedPlatform) return categories;
    return categories.filter(cat => 
      cat.toLowerCase().includes(selectedPlatform.toLowerCase())
    );
  })();

  // Set default selected category once catalog is loaded or platform filter changes
  useEffect(() => {
    if (servicesCatalog.length > 0 && filteredCategories.length > 0) {
      if (!selectedCategory || !filteredCategories.includes(selectedCategory)) {
        console.log('DEBUG: Setting selectedCategory to lowest sort order:', filteredCategories[0]);
        setSelectedCategory(filteredCategories[0]);
      }
    }
  }, [servicesCatalog, filteredCategories, selectedCategory]);

  // Filter service selections based on selected Category in New Order Form
  const filteredServicesForOrder = servicesCatalog.filter(s => s.category === selectedCategory);

  useEffect(() => {
    if (filteredServicesForOrder.length > 0) {
      if (!filteredServicesForOrder.find(s => s.id === selectedServiceId)) {
        setSelectedServiceId(filteredServicesForOrder[0].id);
      }
    } else {
      setSelectedServiceId('');
    }
  }, [selectedCategory, filteredServicesForOrder]);

  // Recalculate cost when Service or Quantity changes
  useEffect(() => {
    const service = servicesCatalog.find(s => s.id === selectedServiceId);
    if (service) {
      const inrRate = getInrRate(service);
      const computedCharge = (inrRate / 1000) * orderQuantity;
      setCalcCharge(parseFloat(computedCharge.toFixed(2)));
    }
  }, [selectedServiceId, orderQuantity, servicesCatalog]);

  // Action: Submit Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderNotification(null);
    setPlacedOrderDetails(null);
    setOrderErrorDetails(null);

    const service = servicesCatalog.find(s => s.id === selectedServiceId);
    if (!service) {
      setOrderNotification({ type: 'error', text: 'Error: Selected service could not be located.' });
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      setOrderNotification({ type: 'error', text: 'Invalid Target URL. Must start with http:// or https://' });
      return;
    }

    if (orderQuantity < service.min || orderQuantity > service.max) {
      setOrderNotification({ type: 'error', text: `Failed limits: Quantity must be between ${service.min} and ${service.max}` });
      return;
    }

    if (currentBalance < calcCharge) {
      setOrderNotification({
        type: 'error',
        text: `Insufficient wallet balance. Required: ₹${calcCharge.toFixed(2)}, Available: ₹${currentBalance.toFixed(2)}. Please proceed to 'Add Funds' to credit your account.`
      });
      return;
    }

    // Prevent double same service on same link (active orders check)
    const hasDuplicateActiveOrder = orders.some(o => {
      const isSameService = String(o.serviceId) === String(selectedServiceId);
      const isSameLink = o.targetUrl && String(o.targetUrl).trim().toLowerCase() === String(targetUrl).trim().toLowerCase();
      const isActiveStatus = o.status === 'Pending' || o.status === 'In Progress';
      return isSameService && isSameLink && isActiveStatus;
    });

    if (hasDuplicateActiveOrder) {
      setOrderNotification({
        type: 'error',
        text: 'Duplicate Order Warning: An active order for this exact service and link is already being processed. Please wait for the current order to complete before placing another.'
      });
      return;
    }

    // Set placing state
    setIsPlacingOrder(true);

    // Call SMM provider API via Express backend to automate order creation
    let providerOrderId: string | undefined = undefined;

    try {
      const res = await fetch(`${API_BASE}/api/smm/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          targetUrl,
          quantity: orderQuantity,
          charge: calcCharge
        })
      });

      const data = await res.json();
      if (data && data.success && data.providerOrderId) {
        providerOrderId = data.providerOrderId;
        console.log("Order automated successfully! Provider Ref ID:", providerOrderId);
      } else {
        throw new Error(data.error || 'The provider API declined this request.');
      }
    } catch (apiErr: any) {
      console.warn("Automation pipeline failure:", apiErr);
      const errMsg = `Order Automation Failure: ${apiErr.message || 'Connecting to provider API failed. Please retry.'}`;
      setOrderNotification({
        type: 'error',
        text: errMsg
      });
      setOrderErrorDetails(errMsg);
      setIsPlacingOrder(false);
      return;
    }

    // Process Purchase on successful API response
    const newBal = currentBalance - calcCharge;
    const orderId = providerOrderId || 'ORD-' + Math.floor(100000 + Math.random() * 900000);

    const newOrder: SMMOrder = {
      id: orderId,
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      targetUrl,
      quantity: orderQuantity,
      charge: calcCharge,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      providerOrderId: providerOrderId || orderId
    };

    try {
      // Save to Supabase (and local storage fallback)
      const dbSuccess = await createDbOrder(session.email, newOrder);
      if (dbSuccess) {
        // Deduct balance and update state
        await saveBalanceToStorage(newBal);

        const updatedOrders = [newOrder, ...orders];
        await saveOrdersToStorage(updatedOrders);
        setOrders(updatedOrders);

        // Log order transaction ledger
        const orderTxId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
        const orderTx: Transaction = {
          id: orderTxId,
          amount: -calcCharge,
          method: 'SMM Order Debit',
          status: 'Success',
          createdAt: new Date().toISOString()
        };
        try {
          await logDbTransaction(session.email, orderTx);
          setTransactions(prev => [orderTx, ...prev]);
        } catch (logErr) {
          console.error("Tx log fail:", logErr);
        }

        // Clean form
        setTargetUrl('');
        setOrderQuantity(service.min);

        // Store details of the successfully placed order to display
        setPlacedOrderDetails({
          orderId: orderId,
          providerOrderId: providerOrderId || orderId,
          serviceName: service.name,
          quantity: orderQuantity,
          charge: calcCharge,
          timestamp: newOrder.createdAt
        });

        setOrderNotification({
          type: 'success',
          text: `Order Confirmed! Ref: ${orderId} (SMM: ${providerOrderId}). ₹${calcCharge.toFixed(2)} deducted.`
        });
      } else {
        const dbErrMsg = 'Failed to write your order sequence directly to the database. Please check Supabase table schemas.';
        setOrderNotification({
          type: 'error',
          text: dbErrMsg
        });
        setOrderErrorDetails(dbErrMsg);
      }
    } catch (err: any) {
      console.error("Critical error in db order save:", err);
      setOrderErrorDetails(err.message || 'Unknown database write error.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Action: Apply Coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponValidationNotice('Coupon code cannot be empty.');
      return;
    }
    setCouponValidationNotice('Validating coupon...');
    try {
      const res = await fetch(`${API_BASE}/api/smm/coupons/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, email: session.email })
      });
      const data = await res.json();
      if (data && data.success) {
        setAppliedCoupon({
          code: couponCode.toUpperCase().trim(),
          discount_percent: data.discount_percent
        });
        setCouponValidationNotice(`Success! Coupon "${couponCode.toUpperCase().trim()}" applied! You get ${data.discount_percent}% extra bonus funds.`);
      } else {
        setCouponValidationNotice(`Failed: ${data.error || 'This coupon code is invalid or expired.'}`);
      }
    } catch (err) {
      setCouponValidationNotice('Could not connect to Coupon verification gateway.');
    }
  };

  // Helper: Dynamically load external scripts (Razorpay SDK)
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Action: Live Razorpay Payment Gateway Integration
  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      setFundsNotification('Please input a positive funding amount.');
      return;
    }
    if (paymentAmount < 1) {
      setFundsNotification('Minimum deposit amount is ₹1.');
      return;
    }

    try {
      setFundsNotification('Initializing payment gateway order... Please wait.');
      
      // 1. Create Razorpay Order on Backend
      const orderResp = await fetch('/api/smm/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          email: session.email,
          couponCode: appliedCoupon ? appliedCoupon.code : null
        })
      });

      const orderData = await orderResp.json();
      if (!orderData.success) {
        setFundsNotification(`Order Creation Failed: ${orderData.error || 'Unknown server error'}`);
        return;
      }

      // 2. Load Razorpay Client SDK Script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setFundsNotification('Failed to load payment gateway assets. Please check your network connection.');
        return;
      }

      setFundsNotification('Opening secure payment gateway...');

      // 3. Trigger Razorpay Standard Checkout Popup Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "SMM Panel",
        description: `Add ₹${paymentAmount} to wallet balance`,
        image: "https://api.dicebear.com/7.x/initials/svg?seed=SMMPanel&backgroundColor=000000",
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            setFundsNotification('Securing and verifying transaction signature...');
            
            // 4. Send verification details to safe backend
            const verifyResp = await fetch('/api/smm/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: session.email,
                amount: paymentAmount,
                couponCode: appliedCoupon ? appliedCoupon.code : null
              })
            });

            const verifyData = await verifyResp.json();
            if (verifyData.success) {
              // Update state locally
              setCurrentBalance(verifyData.newBalance);
              setFundsNotification(verifyData.message || `Successfully added ₹${paymentAmount} to your wallet balance.`);

              // Insert transaction object to local list
              const bonusFactor = appliedCoupon ? (1.0 + appliedCoupon.discount_percent / 100) : 1.0;
              const actualCredited = Math.round(paymentAmount * bonusFactor * 100) / 100;

              const newTx: Transaction = {
                id: response.razorpay_payment_id,
                amount: paymentAmount,
                method: `Razorpay INR Gateway` + (appliedCoupon ? ` [Coupon: ${appliedCoupon.code} (+${appliedCoupon.discount_percent}% Bonus)]` : ''),
                status: 'Success',
                createdAt: new Date().toISOString()
              };

              setTransactions(prev => [newTx, ...prev]);

              // Reset inputs
              setPaymentAmount(1000);
              setCouponCode('');
              setAppliedCoupon(null);
              setCouponValidationNotice(null);
            } else {
              setFundsNotification(`Payment verification failed: ${verifyData.error || 'Invalid signature signature'}`);
            }
          } catch (verifyErr) {
            console.error('Signature verification call error:', verifyErr);
            setFundsNotification('Connection failed while validating payment with secure server ledger.');
          }
        },
        prefill: {
          name: session.name || "",
          email: session.email,
          contact: ""
        },
        theme: {
          color: "#e11d48" // matches SMM design red theme color
        },
        modal: {
          ondismiss: function () {
            setFundsNotification('Payment transaction cancelled by user.');
            setTimeout(() => setFundsNotification(null), 4000);
          }
        }
      };

      const paymentWindow = new (window as any).Razorpay(options);
      paymentWindow.open();

    } catch (err: any) {
      console.error('Razorpay process flow failed:', err);
      setFundsNotification(`System error: ${err.message || 'Payment engine offline.'}`);
    }
  };

  // Action: API token regeneration
  const regenerateApiKey = async () => {
    const keys = 'smm_' + Math.random().toString(36).substring(2, 17).toUpperCase();
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ api_key: keys })
        .eq('email', session.email);
      if (!error) {
        setApiKey(keys);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    if (id === 'api') {
      setProfileNotice("Security access token copied to clipboard!");
      setTimeout(() => setProfileNotice(""), 4000);
    } else {
      setProfileNotice(`Address link copied to system clipboard!`);
      setTimeout(() => setProfileNotice(""), 4000);
    }
  };

  return (
    <div id="dashboard-root" className="min-h-screen bg-black text-white font-sans flex flex-col overflow-x-hidden w-full max-w-full">
      {/* Immersive liquid glassy blur loading overlay */}
      {isPlacingOrder && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-3xl transition-all duration-300">
          <div className="absolute inset-0 bg-radial-gradient from-neutral-900/50 via-black/90 to-black/100 pointer-events-none"></div>
          
          {/* Animated Liquid glass glowing ambient orbs */}
          <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-white/5 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-neutral-800/20 blur-[150px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>

          <div className="relative text-center space-y-6 max-w-sm px-6">
            
            {/* Liquid rotating loader with ring of glass */}
            <div className="relative flex items-center justify-center mx-auto">
              <div className="absolute rounded-full border border-white/5 bg-white/[0.02] w-24 h-24 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]"></div>
              {/* Spinner */}
              <div className="animate-spin rounded-full h-16 w-16 border-2 border-white/5 border-t-white shadow-2xl"></div>
              {/* Inner glowing pulse */}
              <div className="absolute rounded-full h-8 w-8 bg-white/10 animate-ping"></div>
            </div>

            {/* Dynamic visual copy */}
            <div className="space-y-2">
              <h3 className="text-xs font-black font-mono uppercase tracking-[0.2em] text-white animate-pulse">
                Authorizing SMM Order...
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans max-w-xs mx-auto">
                Contacting the SMM pipeline to register your action. Your request is processed instantly via direct upstream protocols. Do not close or refresh this page.
              </p>
            </div>

            {/* Professional sub-indicator bar */}
            <div className="w-32 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
              <div className="w-1/2 h-full bg-neutral-400 rounded-full animate-pulse"></div>
            </div>

          </div>
        </div>
      )}
      
      {/* Immersive liquid glassy blur general loading overlay */}
      {loadingDb && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black backdrop-blur-3xl transition-all duration-300">
          <div className="absolute inset-0 bg-radial-gradient from-neutral-900/50 via-black/90 to-black/100 pointer-events-none"></div>
          
          {/* Animated Liquid glass glowing ambient orbs */}
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-white/5 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/3 w-[350px] h-[350px] rounded-full bg-neutral-800/10 blur-[150px] animate-pulse" style={{ animationDelay: '1s' }}></div>

          <div className="relative text-center space-y-6 max-w-sm px-6">
            
            {/* Logo Group */}
            <div className="flex items-center justify-center space-x-2 select-none mb-4">
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center font-bold text-white shadow-inner shrink-0">
                <span className="text-base font-semibold leading-none animate-pulse">▲</span>
              </div>
              <div className="flex flex-col text-left leading-none">
                <span className="text-sm font-black text-white uppercase tracking-wider font-mono">FOLLOWLIKE</span>
                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest font-mono">EVERYWHERE</span>
              </div>
            </div>

            {/* Liquid rotating loader with ring of glass */}
            <div className="relative flex items-center justify-center mx-auto">
              <div className="absolute rounded-full border border-white/5 bg-white/[0.02] w-20 h-20 shadow-[inset_0_0_15px_rgba(255,255,255,0.03)] animate-pulse"></div>
              {/* Spinner */}
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-white/5 border-t-white shadow-xl" style={{ animationDuration: '0.8s' }}></div>
              {/* Inner glowing pulse */}
              <div className="absolute rounded-full h-6 w-6 bg-white/15 animate-ping"></div>
            </div>

            {/* Dynamic visual copy */}
            <div className="space-y-2">
              <h3 className="text-xs font-black font-mono uppercase tracking-[0.2em] text-neutral-300 animate-pulse">
                Synchronizing SMM Portal...
              </h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed font-sans max-w-xs mx-auto">
                Establishing encrypted Supabase session & loading your transaction history ledger with real-time replication.
              </p>
            </div>

            {/* Professional sub-indicator bar */}
            <div className="w-24 h-0.5 bg-white/10 rounded-full mx-auto overflow-hidden">
              <div className="w-3/4 h-full bg-neutral-400 rounded-full animate-pulse"></div>
            </div>

          </div>
        </div>
      )}
      {/* Background ambient liquid nodes */}
      <div className="fixed top-[-250px] right-[-100px] w-[500px] h-[500px] rounded-full bg-neutral-900/40 blur-[130px] pointer-events-none"></div>
      <div className="fixed bottom-[-150px] left-[-200px] w-[600px] h-[600px] rounded-full bg-neutral-800/10 blur-[150px] pointer-events-none"></div>

      {/* Grid Pattern overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* DASHBOARD TOP HEADER BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-black/80 backdrop-blur-md">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto">
          <div className="flex h-16 items-center justify-between">
            
            {/* Logo Group */}
            <div className="flex items-center space-x-3">
              {/* Mobile Sidebar toggle button */}
              <button
                id="sidebar-toggle-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-1.5 rounded-lg border border-white/10 hover:bg-white/5"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center font-bold text-white shadow-inner shrink-0">
                  <span className="text-sm font-semibold select-none leading-none">▲</span>
                </div>
                <div className="flex flex-col leading-none select-none">
                  <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider font-mono">FOLLOWLIKE</span>
                  <span className="text-[7px] text-neutral-500 font-bold uppercase tracking-widest font-mono">EVERYWHERE</span>
                </div>
              </div>
              <span className="hidden lg:inline-flex px-2 py-0.5 rounded-full border border-white/15 bg-white/[0.04] text-[9px] uppercase font-mono tracking-wider text-neutral-400">
                USER PANEL
              </span>
            </div>

            {/* LOGGED IN USER PROFILE / HEADER CONTROLS */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              
              {/* Live Realtime Connection Indicator Badge */}
              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border border-emerald-500/10 bg-emerald-500/[0.03] text-[9px] uppercase font-mono tracking-wider text-emerald-400 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                <span>Live Syncing</span>
              </div>

              {/* Simulated Ambient Indicators (Screenshot Moon & Message bubbles) */}
              <button
                onClick={() => setActiveTab('menu')}
                className="p-1.5 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                title="System Status"
              >
                <Globe className="w-4 h-4" />
              </button>

              {/* WALLET LEDGER CARD CONTAINER */}
              <div 
                id="wallet-ledger-display" 
                onClick={() => setActiveTab('funds')}
                className="px-3.5 py-1.5 rounded-full border border-white/10 bg-white text-black flex items-center gap-1.5 shadow-sm cursor-pointer hover:bg-neutral-100 transition-colors"
              >
                <span className="text-xs font-black font-sans leading-none">₹</span>
                <span className="text-xs font-mono font-black tracking-tight leading-none">
                  {currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Log Out button */}
              <button
                id="header-logout-btn"
                onClick={onLogout}
                className="p-1.5 border border-white/10 rounded-full hover:bg-white hover:text-black transition-colors"
                title="Log Out Session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>

            </div>
          </div>
        </div>
      </header>

      {/* MIDDLE DASHBOARD LAYOUT GRID */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        
        {/* SIDEBAR NAVIGATION (Desktop) */}
        <aside className="hidden md:block w-60 shrink-0 space-y-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2 space-y-1">
            <button
              id="sidebar-tab-home"
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'home' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Globe className="w-4 h-4 mr-3 animate-loop-spin-slow" />
              Dashboard
            </button>

            <button
              id="sidebar-tab-neworder"
              onClick={() => setActiveTab('new-order')}
              className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'new-order' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <PlusCircle className="w-4 h-4 mr-3 animate-loop-pulse-gentle" />
              New Order
            </button>

            <button
              id="sidebar-tab-orders"
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'orders' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Clock className="w-4 h-4 mr-3 animate-loop-clock" />
              Orders
              {orders.filter(o => o.status === 'In Progress' || o.status === 'Pending').length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-white text-black font-mono text-[9px] font-bold">
                  {orders.filter(o => o.status === 'In Progress' || o.status === 'Pending').length}
                </span>
              )}
            </button>

            <button
              id="sidebar-tab-services"
              onClick={() => setActiveTab('services')}
              className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'services' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Layers className="w-4 h-4 mr-3 animate-loop-float" />
              Services
            </button>

            <button
              id="sidebar-tab-funds"
              onClick={() => setActiveTab('funds')}
              className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'funds' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <CreditCard className="w-4 h-4 mr-3 animate-loop-card" />
              Add Funds
            </button>

            <button
              id="sidebar-tab-support"
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'support' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <MessageSquare className="w-4 h-4 mr-3 animate-loop-wiggle" />
              Support
            </button>

            <button
              id="sidebar-tab-profile"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'profile' ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <User className="w-4 h-4 mr-3 animate-loop-breathe" />
              Settings
            </button>

            {session.isAdmin && (
              <a
                href="/admin"
                id="sidebar-tab-admin"
                className={`w-full flex items-center px-4 py-3 text-xs font-semibold rounded-lg transition-all border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] text-neutral-300`}
              >
                <Shield className="w-4 h-4 mr-3 animate-loop-shield" />
                Admin
              </a>
            )}
          </div>

          {/* Refund Notice in sidebar to prevent visual clutter */}
          <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 text-[10px] space-y-2">
            <div className="font-semibold text-white flex items-center gap-1 uppercase tracking-wider">
              <Shield className="w-3 h-3" />
              Refund Covenant
            </div>
            <p className="text-neutral-500 leading-normal font-sans">
              No refunds are supported. Placed orders are hardcoded to API distributors instantly. Please confirm links twice.
            </p>
          </div>
        </aside>

        {/* MOBILE SIDEBAR PANEL (Drawer overlay) */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex">
            <div className="w-64 bg-black border-r border-white/10 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-white flex items-center justify-center font-bold text-black text-xs">
                      F
                     </div>
                    <span className="text-sm font-semibold text-white font-mono">FOLLOWLIKE EVERYWHERE</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 border border-white/10 rounded-lg text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                    {[
                      { key: 'home', label: 'Home Dashboard', icon: Globe, animateClass: 'animate-loop-spin-slow' },
                      { key: 'new-order', label: 'New Order Form', icon: PlusCircle, animateClass: 'animate-loop-pulse-gentle' },
                      { key: 'orders', label: 'Order Placements', icon: Clock, animateClass: 'animate-loop-clock' },
                      { key: 'services', label: 'Services Catalogue', icon: Layers, animateClass: 'animate-loop-float' },
                      { key: 'funds', label: 'Add Funds', icon: CreditCard, animateClass: 'animate-loop-card' },
                      { key: 'support', label: 'WhatsApp Support', icon: MessageSquare, animateClass: 'animate-loop-wiggle' },
                      { key: 'profile', label: 'Account Profile', icon: User, animateClass: 'animate-loop-breathe' }
                    ].map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        id={`mob-sidebar-tab-${tab.key}`}
                        onClick={() => {
                          setActiveTab(tab.key as any);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center px-4 py-3 text-xs font-medium rounded-lg transition-all ${
                          activeTab === tab.key ? 'bg-white text-black font-semibold' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <TabIcon className={`w-4 h-4 mr-3 ${tab.animateClass || ''}`} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Profile card & Logout in mobile sidebar footer */}
              <div className="border-t border-white/10 pt-4 mt-auto">
                <div className="flex items-center gap-3 mb-4">
                  <img src={userProfilePic} className="w-8 h-8 rounded-full border border-white/10" />
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-white truncate">{session.name}</div>
                    <div className="text-[9px] text-neutral-500 font-mono truncate">{session.email}</div>
                  </div>
                </div>
                <button
                  id="mob-logout-btn"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs rounded-lg hover:bg-neutral-800 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Close Active Session
                </button>
              </div>
            </div>
            
            {/* Click backdrop to exit */}
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)}></div>
          </div>
        )}

        {/* ACTIVE MODULE VIEW CONTAINER */}
        <main className="flex-1 min-w-0 pb-24 md:pb-6">
          
          {/* TAB 0: HOME MULTI-METRIC TRACKER */}
          {activeTab === 'home' && (
            <div id="view-dashboard-home" className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              
              {/* Premium Welcome Glassmorphic Banner */}
              <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900 via-black to-neutral-950 p-6 sm:p-8 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/[0.02] rounded-full blur-[60px] pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-neutral-300 font-mono uppercase tracking-wider mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      FollowLike Active
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-none font-display">
                      Welcome, <span className="text-neutral-300 font-normal">{session.name}</span>!
                    </h2>
                    <p className="text-xs text-neutral-400 mt-2 max-w-md leading-relaxed">
                      Grow your social channels with easy, high-quality promotional campaigns.
                    </p>
                  </div>
                  
                  {/* Dynamic clock panel */}
                  <div className="flex flex-col items-start sm:items-end font-mono border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 shrink-0">
                    <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">System Status</span>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mt-0.5">● 100% Operational</span>
                    <span className="text-xs font-medium text-white tracking-widest mt-1">
                      {timeString || '00:00:00'} IST
                    </span>
                  </div>
                </div>

                {dbError && (
                  <div className="mt-4 p-2 rounded bg-red-950/20 border border-red-500/20 text-[10px] text-red-400 font-mono">
                    ⚠️ Connection status delay: {dbError}
                  </div>
                )}
              </div>

              {/* Quick Actions Control Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => setActiveTab('new-order')}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white text-black hover:bg-neutral-200 active:scale-[0.98] transition-all cursor-pointer font-bold text-xs uppercase tracking-wider group"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                    Place Order
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => setActiveTab('funds')}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer font-bold text-xs uppercase tracking-wider group"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Add Funds
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => setActiveTab('services')}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer font-bold text-xs uppercase tracking-wider group"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Catalog Rates
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => setActiveTab('support')}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer font-bold text-xs uppercase tracking-wider group"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Bento Grid Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Balance Card */}
                <div 
                  onClick={() => setActiveTab('funds')}
                  className="group relative p-5 rounded-2xl glass-card glass-card-hover cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest font-bold">Wallet Balance</div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono text-white tracking-tight">
                      ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>Best Pricing</span>
                      <span className="text-emerald-400 hover:underline group-hover:translate-x-0.5 transition-transform">+ Recharge</span>
                    </div>
                  </div>
                </div>

                {/* Orders Card */}
                <div 
                  onClick={() => setActiveTab('orders')}
                  className="p-5 rounded-2xl glass-card glass-card-hover cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest font-bold">Active Requests</div>
                    <div className="p-2 rounded-lg bg-neutral-800 text-neutral-300 border border-white/5">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono text-white tracking-tight">
                      {orders.length}
                    </div>
                    <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>Total Queue Placed</span>
                      <span className="text-neutral-300 hover:underline">Audits ↗</span>
                    </div>
                  </div>
                </div>

                {/* Total Spent Card */}
                <div 
                  onClick={() => setActiveTab('services')}
                  className="p-5 rounded-2xl glass-card glass-card-hover cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest font-bold">Total Investments</div>
                    <div className="p-2 rounded-lg bg-neutral-800 text-neutral-300 border border-white/5">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono text-white tracking-tight">
                      ₹{orders.reduce((sum, o) => sum + o.charge, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>All-time Spent</span>
                      <span className="text-neutral-300 hover:underline">Catalog ↗</span>
                    </div>
                  </div>
                </div>

                {/* Support Card */}
                <div 
                  onClick={() => setActiveTab('support')}
                  className="p-5 rounded-2xl glass-card glass-card-hover cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest font-bold">Support Gateway</div>
                    <div className="p-2 rounded-lg bg-neutral-800 text-neutral-300 border border-white/5">
                      <LifeBuoy className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-black text-white font-display tracking-tight">
                      LIVE 24/7
                    </div>
                    <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>Response &lt; 5 Min</span>
                      <span className="text-neutral-300 hover:underline">WhatsApp ↗</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* SMM Channel Operational Status Widget */}
              <div className="rounded-2xl border border-white/5 bg-neutral-950 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-neutral-400" />
                    <h3 className="text-xs font-semibold uppercase text-white font-mono tracking-wider">Live Platform Status</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase">
                    All pipelines stable
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                  {[
                    { name: 'Instagram API', delay: '0-5m start', state: 'Operational' },
                    { name: 'YouTube Core', delay: 'Instant', state: 'Operational' },
                    { name: 'Twitter (X) Feed', delay: '5-15m start', state: 'Stable' },
                    { name: 'WhatsApp Support', delay: '< 2m response', state: 'Active' }
                  ].map((chan, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-white/5 bg-white/[0.01] space-y-1.5">
                      <div className="text-xs font-bold text-white truncate">{chan.name}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-neutral-500">{chan.delay}</span>
                        <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block"></span>
                          {chan.state}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders Overview */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold uppercase text-neutral-400 font-mono tracking-wider">Recent Transactions</h3>
                  <button onClick={() => setActiveTab('orders')} className="text-[10px] text-white hover:underline uppercase font-mono font-bold">View All Orders</button>
                </div>

                <div className="overflow-hidden border border-white/5 bg-neutral-950 rounded-2xl divide-y divide-white/[0.04]">
                  {orders.slice(0, 3).length > 0 ? (
                    orders.slice(0, 3).map((order) => (
                      <div key={order.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.01] hover:bg-white/[0.02] transition-all">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] text-neutral-300 font-black select-all border border-white/10 px-2 py-0.5 rounded bg-neutral-900">{order.id}</span>
                            <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-white/5 text-[9px] text-neutral-400 font-mono uppercase truncate max-w-[120px]" title={order.category}>
                              {order.category}
                            </span>
                          </div>
                          <div className="text-xs text-white font-extrabold truncate">{order.serviceName}</div>
                          <div className="text-[10px] text-neutral-500 font-mono truncate select-all">{order.targetUrl}</div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                          <div className="text-left md:text-right">
                            <div className="text-[9px] text-neutral-500 uppercase font-mono">Quantity</div>
                            <div className="text-xs font-bold text-neutral-300 font-mono">{order.quantity.toLocaleString()}</div>
                          </div>
                          <div className="text-left md:text-right">
                            <div className="text-[9px] text-neutral-500 uppercase font-mono">Cost</div>
                            <div className="text-xs font-bold text-emerald-400 font-mono">₹{order.charge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div className="text-right min-w-[90px]">
                            <span className={`inline-block px-2.5 py-1 rounded-full font-mono text-[9px] font-black uppercase tracking-wider ${
                              order.status === 'Completed'
                                ? 'bg-white text-black font-extrabold'
                                : order.status === 'In Progress'
                                ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold'
                                : 'bg-black text-neutral-500 border border-neutral-900'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-neutral-500 font-mono">
                      No orders found under your account yet. Go to the New Order tab to place one!
                    </div>
                  )}
                </div>
              </div>

              {/* Speciality Badge & FAQ Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-white/5 bg-neutral-900/40 space-y-2">
                  <h4 className="text-xs font-extrabold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-neutral-400" />
                    🔒 Safe & Secure
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                    We don't need your account password or logins. Your profiles are completely safe with us.
                  </p>
                </div>
                <div className="p-5 rounded-2xl border border-white/5 bg-neutral-900/40 space-y-2">
                  <h4 className="text-xs font-extrabold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-neutral-400" />
                    ⚡ Fast Delivery
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                    Most campaigns start instantly. Just make sure your profile is public so we can process your request.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 1: NEW ORDER FORM */}
          {activeTab === 'new-order' && (
            <div id="view-new-order" className="space-y-6">
              {placedOrderDetails ? (
                /* Successful Order Display Screen */
                <div id="order-success-screen" className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-neutral-900/80 to-neutral-950/80 p-6 sm:p-8 space-y-6 backdrop-blur-xl relative overflow-hidden shadow-2xl max-w-xl mx-auto my-8">
                  {/* Background ambient light */}
                  <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
                  <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>

                  {/* Animated Green Pulsing Check Shield */}
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="relative flex items-center justify-center">
                      <span className="absolute inline-flex h-16 w-16 rounded-full bg-emerald-500/20 animate-ping opacity-75"></span>
                      <div className="relative rounded-full bg-emerald-500/10 border border-emerald-500/30 p-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                        Order Placed Successfully!
                      </h2>
                      <p className="text-xs text-emerald-400/80 font-mono font-medium tracking-widest">
                        PROVIDER PIPELINE CONFIRMED
                      </p>
                    </div>
                  </div>

                  {/* Detailed Information Grid */}
                  <div className="space-y-3 pt-2">
                    <div className="rounded-xl border border-white/5 bg-neutral-950/60 p-4 space-y-3 text-xs">
                      
                      {/* Service Name */}
                      <div className="flex flex-col gap-1 pb-2 border-b border-white/5">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-500">Service</span>
                        <span className="text-xs font-extrabold text-white leading-relaxed">
                          {placedOrderDetails.serviceName}
                        </span>
                      </div>

                      {/* Order ID & Provider Ref */}
                      <div className="grid grid-cols-2 gap-4 py-1">
                        <div>
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-500 block mb-1">Local Order ID</span>
                          <span className="font-mono text-[11px] font-black text-neutral-200 select-all">
                            {placedOrderDetails.orderId}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-500 block mb-1">Provider Ref ID</span>
                          <span className="font-mono text-[11px] font-black text-white select-all">
                            {placedOrderDetails.providerOrderId}
                          </span>
                        </div>
                      </div>

                      {/* Quantity & Charge */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                        <div>
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-500 block mb-1">Quantity</span>
                          <span className="font-mono font-extrabold text-neutral-300">
                            {placedOrderDetails.quantity.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-500 block mb-1">Total Charge</span>
                          <span className="font-mono font-black text-emerald-400 text-sm">
                            ₹{placedOrderDetails.charge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-neutral-400">
                        <span className="font-mono uppercase font-bold tracking-wider text-neutral-500">Placed Timestamp</span>
                        <span className="font-mono text-[11px] text-neutral-300">
                          {new Date(placedOrderDetails.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Return Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPlacedOrderDetails(null);
                        setOrderNotification(null);
                      }}
                      className="w-full py-3.5 rounded-xl text-xs font-black bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all uppercase tracking-wider text-center flex items-center justify-center gap-2"
                    >
                      Place More Orders
                    </button>
                  </div>
                </div>
              ) : orderErrorDetails ? (
                /* Failed Order Display Screen */
                <div id="order-failure-screen" className="rounded-2xl border border-red-500/20 bg-gradient-to-b from-neutral-900/80 to-neutral-950/80 p-6 sm:p-8 space-y-6 backdrop-blur-xl relative overflow-hidden shadow-2xl max-w-xl mx-auto my-8">
                  {/* Background ambient light */}
                  <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-red-500/10 blur-3xl pointer-events-none"></div>

                  {/* Red warning icon */}
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="relative rounded-full bg-red-500/10 border border-red-500/30 p-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                      <AlertTriangle className="w-8 h-8 text-red-400 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                        Order Placement Failed
                      </h2>
                      <p className="text-xs text-red-400/80 font-mono font-medium tracking-widest">
                        PIPELINE ACTION ABORTED
                      </p>
                    </div>
                  </div>

                  {/* Detailed Error Details */}
                  <div className="rounded-xl border border-white/5 bg-neutral-950/60 p-4 text-xs space-y-2">
                    <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-500">
                      Failure Reason
                    </div>
                    <div className="text-neutral-300 font-sans leading-relaxed text-[11px]">
                      {orderErrorDetails || "An unexpected error occurred while routing the order to the processing server. Your balance has NOT been deducted."}
                    </div>
                  </div>

                  {/* Dismiss Action Button */}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderErrorDetails(null);
                      }}
                      className="w-full py-3.5 rounded-xl text-xs font-black bg-red-600 text-white hover:bg-red-500 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.15)] transition-all uppercase tracking-wider text-center"
                    >
                      Dismiss & Adjust Parameters
                    </button>
                  </div>
                </div>
              ) : (
                /* SMM Order Form */
                <>
                  {/* Promo Banner / Welcome indicator */}
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-white flex items-center gap-1.5 font-mono uppercase tracking-wider">
                        ⚡ New Order
                      </h2>
                      <p className="text-xs text-neutral-400 mt-1 leading-normal">
                        Select a service and place your order.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-semibold bg-white/[0.04] p-2 border border-white/5 rounded-lg whitespace-nowrap">
                      Online
                    </div>
                  </div>

                  {/* Category Quick Platform Pills (Screenshot-like visual helper) */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold text-neutral-500 uppercase font-mono tracking-wider">
                      Quick Category Filters
                    </span>
                    <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1 scrollbar-none">
                      {['Instagram', 'YouTube', 'Twitter', 'TikTok', 'Facebook'].map((plat) => {
                        const isActive = selectedPlatform.toLowerCase() === plat.toLowerCase();
                        return (
                          <button
                            key={plat}
                            type="button"
                            onClick={() => {
                              if (selectedPlatform.toLowerCase() === plat.toLowerCase()) {
                                // If clicking again, reset/deselect to show all categories
                                setSelectedPlatform('');
                              } else {
                                setSelectedPlatform(plat);
                              }
                            }}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0 ${
                              isActive
                                ? 'bg-white text-black border-white font-black'
                                : 'bg-neutral-950 text-neutral-400 border-white/10 hover:text-white hover:bg-neutral-900'
                            }`}
                          >
                            {plat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form card wrapped in Liquid Glass */}
                  <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-6">
                    
                    {orderNotification && (
                      <div
                        id="order-notification-card"
                        className={`p-4 rounded-xl flex items-start gap-2.5 text-xs ${
                          orderNotification.type === 'success'
                            ? 'bg-neutral-900 border border-white/20 text-white'
                            : 'bg-red-950/40 border border-red-900/60 text-red-300'
                        }`}
                      >
                        {orderNotification.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-white" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                        )}
                        <div>{orderNotification.text}</div>
                      </div>
                    )}

                    <form id="smm-place-order-form" onSubmit={handlePlaceOrder} className="space-y-5">
                      
                      {/* Category select dropdown */}
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase font-mono tracking-wider">
                          Category
                        </label>
                        <button
                          type="button"
                          id="custom-category-dropdown-trigger"
                          onClick={() => {
                            setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                            setIsServiceDropdownOpen(false); // close other dropdown
                          }}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-xs text-white rounded-xl bg-neutral-950 border border-white/10 hover:border-white/20 focus:border-white focus:outline-none transition-all text-left font-sans cursor-pointer"
                        >
                          <span className="truncate flex items-center gap-1.5">
                            {selectedCategory && servicesCatalog.find(s => s.category === selectedCategory)?.categorySortOrder === -1000000 && (
                              <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400 rotate-45 shrink-0" />
                            )}
                            {selectedCategory ? `${selectedCategory} Services` : 'Select a Category'}
                          </span>
                          <ChevronDown className={`w-4 h-4 ml-2 shrink-0 text-neutral-500 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isCategoryDropdownOpen && (
                          <>
                            {/* Overlay to handle click outside */}
                            <div 
                              className="fixed inset-0 z-40 bg-transparent" 
                              onClick={() => {
                                  setIsCategoryDropdownOpen(false);
                                  setCategorySearchQuery('');
                              }} 
                            />
                            
                            <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-200">
                              {/* Search Bar */}
                              <div className="p-2 border-b border-white/5 flex items-center gap-2 bg-neutral-900/50">
                                <Search className="w-3.5 h-3.5 text-neutral-500 ml-1 shrink-0" />
                                <input
                                  type="text"
                                  placeholder="Search categories..."
                                  value={categorySearchQuery}
                                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                                  className="w-full bg-transparent border-none text-[11px] text-white focus:outline-none placeholder-neutral-600 font-sans"
                                />
                                {categorySearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setCategorySearchQuery('')}
                                    className="text-[10px] text-neutral-500 hover:text-white px-1.5 py-0.5"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>

                              {/* Category Items */}
                              <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                                {filteredCategories.length === 0 && (
                                  <div className="p-3 text-center text-xs text-neutral-500 font-sans">
                                    Loading categories...
                                  </div>
                                )}
                                {filteredCategories.length > 0 && (() => {
                                  const filtered = filteredCategories.filter(cat => 
                                    cat.toLowerCase().includes(categorySearchQuery.toLowerCase())
                                  );
                                  if (filtered.length === 0) {
                                    return (
                                      <div className="p-3 text-center text-xs text-neutral-500 font-sans">
                                        No categories match "{categorySearchQuery}"
                                      </div>
                                    );
                                  }
                                  return filtered.map(cat => {
                                    const isSelected = cat === selectedCategory;
                                    const isPinned = servicesCatalog.find(s => s.category === cat)?.categorySortOrder === -1000000;
                                    return (
                                      <button
                                        key={cat}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCategory(cat);
                                          setIsCategoryDropdownOpen(false);
                                          setCategorySearchQuery('');
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs text-left cursor-pointer transition-all ${
                                          isSelected 
                                            ? 'bg-white/10 text-white font-semibold border-l-2 border-white' 
                                            : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                                        }`}
                                      >
                                        <span className="truncate flex items-center gap-1.5">
                                          {isPinned && <Pin className="w-3 h-3 text-amber-400 fill-amber-400 rotate-45 shrink-0" />}
                                          <span>{cat} Services</span>
                                          {isPinned && <span className="text-[8px] bg-amber-500/15 text-amber-400 px-1 py-0.2 rounded uppercase font-bold tracking-wider">Pinned</span>}
                                        </span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Service select dropdown */}
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase font-mono tracking-wider">
                          Service
                        </label>
                        <button
                          type="button"
                          id="custom-service-dropdown-trigger"
                          onClick={() => {
                            setIsServiceDropdownOpen(!isServiceDropdownOpen);
                            setIsCategoryDropdownOpen(false); // close other dropdown
                          }}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-xs text-white rounded-xl bg-neutral-950 border border-white/10 hover:border-white/20 focus:border-white focus:outline-none transition-all text-left font-sans leading-relaxed cursor-pointer"
                        >
                          <span className="truncate max-w-[90%] block">
                            {(() => {
                              const s = servicesCatalog.find(s => s.id === selectedServiceId);
                              if (s) {
                                return `${s.name} — ₹${getInrRate(s)}/1k`;
                              }
                              return 'Select a Service';
                            })()}
                          </span>
                          <ChevronDown className={`w-4 h-4 ml-2 shrink-0 text-neutral-500 transition-transform duration-200 ${isServiceDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isServiceDropdownOpen && (
                          <>
                            {/* Overlay to handle click outside */}
                            <div 
                              className="fixed inset-0 z-40 bg-transparent" 
                              onClick={() => {
                                setIsServiceDropdownOpen(false);
                                setServiceSearchQuery('');
                              }} 
                            />
                            
                            <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-200 font-sans">
                              {/* Search Bar */}
                              <div className="p-2 border-b border-white/5 flex items-center gap-2 bg-neutral-900/50">
                                <Search className="w-3.5 h-3.5 text-neutral-500 ml-1 shrink-0" />
                                <input
                                  type="text"
                                  placeholder="Search service name or ID..."
                                  value={serviceSearchQuery}
                                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                                  className="w-full bg-transparent border-none text-[11px] text-white focus:outline-none placeholder-neutral-600 font-sans"
                                />
                                {serviceSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setServiceSearchQuery('')}
                                    className="text-[10px] text-neutral-500 hover:text-white px-1.5 py-0.5"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>

                              {/* Service Items */}
                              <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                                {filteredServicesForOrder.length === 0 && (
                                  <div className="p-3 text-center text-xs text-neutral-500 font-sans">
                                    No services available for this category
                                  </div>
                                )}
                                {filteredServicesForOrder.length > 0 && (() => {
                                  const filtered = filteredServicesForOrder.filter(s => 
                                    s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                                    String(s.id).includes(serviceSearchQuery)
                                  );
                                  if (filtered.length === 0) {
                                    return (
                                      <div className="p-3 text-center text-xs text-neutral-500 font-sans">
                                        No services match "{serviceSearchQuery}"
                                      </div>
                                    );
                                  }
                                  return filtered.map(service => {
                                    const isSelected = service.id === selectedServiceId;
                                    return (
                                      <button
                                        key={service.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedServiceId(service.id);
                                          setIsServiceDropdownOpen(false);
                                          setServiceSearchQuery('');
                                        }}
                                        className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg text-xs text-left cursor-pointer transition-all ${
                                          isSelected 
                                            ? 'bg-white/10 text-white font-semibold border-l-2 border-white font-sans' 
                                            : 'text-neutral-400 hover:text-white hover:bg-white/[0.04] font-sans'
                                        }`}
                                      >
                                        <div className="flex flex-col gap-0.5 min-w-0 flex-1 text-left">
                                          <span className="break-words whitespace-normal leading-normal font-sans pr-1">
                                            {service.name}
                                          </span>
                                          <span className="text-[9px] text-neutral-500 font-mono mt-0.5">ID: #{service.id}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0 text-right pt-0.5">
                                          <span className="text-[11px] font-mono text-emerald-400 font-bold whitespace-nowrap">
                                            ₹{getInrRate(service)}/1k
                                          </span>
                                          {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                                        </div>
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                        {/* Service Description display */}
                        <div className="mt-2.5 p-3.5 rounded-xl bg-neutral-950/80 text-[11px] text-neutral-300 leading-relaxed font-sans border border-white/5 break-words">
                          {renderDescription(servicesCatalog.find(s => s.id === selectedServiceId)?.description || '')}
                        </div>
                      </div>

                      {/* Target URL input */}
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase font-mono tracking-wider">
                          Link
                        </label>
                        <div className="relative">
                          <input
                            id="order-target-link"
                            type="url"
                            required
                            placeholder="e.g. https://www.instagram.com/p/..."
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            className="w-full px-4 py-3 text-xs text-white rounded-xl bg-neutral-950 border border-white/10 focus:border-white focus:outline-none transition-all placeholder-neutral-600 font-sans"
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] text-neutral-500 font-sans">
                          Your account or post must be set to public.
                        </p>
                      </div>

                      {/* Quantity and Charge side-by-side columns (Screenshot 2 style!) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        
                        {/* Quantity left input */}
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase font-mono tracking-wider">
                            Quantity
                          </label>
                          <input
                            id="order-quantity-input"
                            type="number"
                            required
                            step="1"
                            value={orderQuantity}
                            onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full px-4 py-3 text-xs text-white rounded-xl bg-neutral-950 border border-white/10 focus:border-white focus:outline-none transition-all placeholder-neutral-600 font-mono font-bold"
                          />
                          <div className="mt-1.5 flex justify-between text-[9px] text-neutral-500 font-mono">
                            <span>Min: {servicesCatalog.find(s => s.id === selectedServiceId)?.min.toLocaleString() || '100'}</span>
                            <span>Max: {servicesCatalog.find(s => s.id === selectedServiceId)?.max.toLocaleString() || '50,000'}</span>
                          </div>
                        </div>

                        {/* Charge right label preview card */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col justify-between">
                          <div className="text-[10px] font-bold text-neutral-400 uppercase font-mono tracking-wider">
                            Estimated Charge
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-2xl font-black text-white font-mono">
                              ₹{calcCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              ₹{getInrRate(servicesCatalog.find(s => s.id === selectedServiceId) || servicesCatalog[0])} / 1k
                            </span>
                          </div>
                          <div className="text-[9px] text-neutral-500 font-mono mt-1 pt-1 border-t border-white/5 flex justify-between">
                            <span>Remaining Balance:</span>
                            <span className="font-bold text-neutral-400">
                              ₹{(currentBalance - calcCharge >= 0 ? currentBalance - calcCharge : 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                      </div>

                      {/* Submission and guidelines footer */}
                      <div className="pt-3 space-y-3.5">
                        <button
                          id="submit-order-form-btn"
                          type="submit"
                          className="w-full py-3.5 rounded-xl text-xs font-black bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all uppercase tracking-wider"
                        >
                          Place Order
                        </button>
                        
                        <div className="text-center text-[10px] text-neutral-500 font-mono">
                          * Orders start processing instantly. Automatic refund if the order fails.
                        </div>
                      </div>

                    </form>

                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: ORDER HISTORIES */}
          {activeTab === 'orders' && (
            <div id="view-orders-history" className="space-y-6">
              
              {/* Header Title */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-tight">Your Orders</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Track your order status and progress details in real time.</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => syncActiveOrdersStatus(false)}
                    disabled={syncingStatus}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold font-mono tracking-tight uppercase bg-white/5 border border-white/10 text-neutral-300 rounded-lg hover:bg-white/10 transition-all ${
                      syncingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingStatus ? 'animate-spin' : ''}`} />
                    {syncingStatus ? 'Syncing...' : 'Sync Status'}
                  </button>
                  <div className="text-[10px] text-neutral-500 font-mono bg-neutral-950 border border-white/5 px-2.5 py-1 rounded-lg">
                    Total Orders: {orders.length}
                  </div>
                </div>
              </div>

              {/* Real-time synchronization notice */}
              {syncNotice && (
                <div className="p-3 bg-neutral-950/40 border border-white/10 rounded-xl text-xs text-neutral-300 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                  <div className="flex-1">{syncNotice}</div>
                </div>
              )}

              {/* Status Pills Row (Screenshot 1: ALL, Pending, Processing, Completed, Canceled) */}
              <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 scrollbar-none">
                {[
                  { label: 'ALL', value: 'ALL' },
                  { label: 'Pending', value: 'Pending' },
                  { label: 'Processing', value: 'Processing' }, // maps to 'In Progress'
                  { label: 'Completed', value: 'Completed' },
                  { label: 'Canceled', value: 'Canceled' } // maps to 'Cancelled'
                ].map((pill) => (
                  <button
                    key={pill.value}
                    onClick={() => setOrderFilterStatus(pill.value)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0 ${
                      orderFilterStatus === pill.value
                        ? 'bg-white text-black border-white'
                        : 'bg-neutral-950 text-neutral-400 border-white/10 hover:text-white hover:bg-neutral-900'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Search bar (Screenshot 1: Search orders...) */}
              <div className="relative">
                <input
                  id="order-logs-search"
                  type="text"
                  placeholder="Search orders..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-4 pr-10 text-xs text-white rounded-xl bg-neutral-950 border border-white/10 focus:border-white focus:outline-none transition-all placeholder-neutral-500 font-sans"
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-500">
                  <Search className="w-4 h-4" />
                </span>
              </div>

              {/* Grid lists of cards resembling Screenshot 1 */}
              <div className="space-y-4">
                {(() => {
                  const filteredOrders = orders.filter(order => {
                    // Status tag map
                    const statusLower = order.status.toLowerCase();
                    if (orderFilterStatus !== 'ALL') {
                      if (orderFilterStatus === 'Pending' && statusLower !== 'pending') return false;
                      if (orderFilterStatus === 'Processing' && statusLower !== 'in progress') return false;
                      if (orderFilterStatus === 'Completed' && statusLower !== 'completed') return false;
                      if (orderFilterStatus === 'Canceled' && statusLower !== 'cancelled') return false;
                    }

                    // Search input
                    if (orderSearchQuery.trim() !== '') {
                      const q = orderSearchQuery.toLowerCase();
                      return (
                        order.id.toLowerCase().includes(q) ||
                        order.serviceName.toLowerCase().includes(q) ||
                        order.targetUrl.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  });

                  if (filteredOrders.length === 0) {
                    return (
                      <div className="p-12 text-center rounded-xl border border-white/5 bg-white/[0.01] text-neutral-500 font-mono text-xs">
                        No orders match the filtered state. Set up order parameters to initialize.
                      </div>
                    );
                  }

                  // Start and Remains dynamic helpers
                  const getStartVal = (o: SMMOrder) => {
                    let hash = 0;
                    for (let i = 0; i < o.id.length; i++) {
                      hash = o.id.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    return Math.abs(hash % 8000) + 500;
                  };

                  const getRemainsVal = (o: SMMOrder) => {
                    if (o.status === 'Completed' || o.status === 'Cancelled') return '-';
                    if (o.status === 'Pending') return o.quantity.toString();
                    let hash = 0;
                    for (let i = 0; i < o.id.length; i++) {
                      hash = o.id.charCodeAt(i) + ((hash << 5) - hash);
                    }
                    return (Math.abs(hash % o.quantity) + 1).toString();
                  };

                  return filteredOrders.map((order) => {
                    const isCompleted = order.status === 'Completed';
                    const isInProgress = order.status === 'In Progress';
                    const isPending = order.status === 'Pending';
                    const isCancelled = order.status === 'Cancelled';

                    // Form stable mock ID suffix
                    const charCodeSum = order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const displayId = `ord_${charCodeSum}${Date.parse(order.createdAt).toString().slice(-4)}_${order.id.slice(-5)}`;

                    return (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4 hover:border-white/10 transition-all"
                      >
                        {/* Title Row with Capsule ID and target link */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <span className="px-3 py-1 rounded bg-neutral-950 border border-white/10 font-mono text-[10px] text-neutral-400 select-all font-semibold">
                            {displayId}
                          </span>
                          <a
                            href={order.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-white hover:underline flex items-center gap-1 shrink-0 px-2 py-0.5 border border-white/10 rounded"
                          >
                            <Link className="w-3 h-3" />
                            ↗ Link
                          </a>
                        </div>

                        {/* Status tag */}
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border tracking-wider ${
                            isCompleted
                              ? 'bg-white text-black border-white'
                              : isInProgress
                              ? 'bg-black text-neutral-300 border-white/20'
                              : isPending
                              ? 'bg-black text-neutral-500 border-white/10'
                              : 'bg-black text-red-400 border-red-900/40'
                          }`}>
                            {isCompleted ? 'COMPLETED' : isInProgress ? 'IN PROGRESS' : isPending ? 'PENDING' : 'CANCELED'}
                          </span>
                        </div>

                        {/* Dot Bullet and Service name */}
                        <div className="flex items-start gap-2 pt-1">
                          <span className="w-2.5 h-2.5 rounded-full mt-1.5 bg-neutral-400 shrink-0 inline-block"></span>
                          <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-relaxed">
                            {order.serviceName}
                          </h3>
                        </div>

                        {/* Elegant metric border display for Quantity */}
                        <div className="border-t border-b border-white/[0.05] py-3 my-2 text-center bg-white/[0.01] rounded-lg">
                          <div>
                            <div className="text-[10px] text-neutral-500 font-bold uppercase font-mono tracking-wider">Quantity</div>
                            <div className="text-sm font-mono font-black text-white mt-0.5">{order.quantity.toLocaleString()}</div>
                          </div>
                        </div>

                        {/* Bottom line: Timestamp and Big price marker */}
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {new Date(order.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            })}
                          </span>
                          <span className="text-sm font-extrabold text-white font-mono leading-none">
                            ₹{order.charge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                      </div>
                    );
                  });
                })()}
              </div>

            </div>
          )}

          {/* TAB 3: SERVICES AND RATES LIST */}
          {activeTab === 'services' && (
            <div id="view-dashboard-services" className="space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Services</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Browse available services and rates.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshServices(true)}
                    disabled={refreshingServices}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold font-mono tracking-tight uppercase bg-white/5 border border-white/10 text-neutral-300 rounded-lg hover:bg-white/10 transition-all ${
                      refreshingServices ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingServices ? 'animate-spin' : ''}`} />
                    {refreshingServices ? 'Refreshing...' : 'Refresh Catalog'}
                  </button>
                  {/* Sub search input */}
                  <div className="w-full sm:w-60">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        id="dash-services-search"
                        type="text"
                        placeholder="Search services..."
                        value={servicesSearch}
                        onChange={(e) => setServicesSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs text-white rounded-lg glass-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Category tabs row */}
              <div className="flex flex-wrap gap-1.5 pb-2">
                {platforms.map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setServicesFilterPlatform(plat)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-tight transition-all ${
                      servicesFilterPlatform === plat
                        ? 'bg-white text-black font-semibold'
                        : 'text-neutral-400 hover:text-white bg-white/[0.02] border border-white/5'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>

              {/* Grid content */}
              <div className="space-y-6">
                {Object.entries(filteredAndGroupedServices).map(([category, services]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="text-sm font-semibold text-white tracking-tight border-b border-white/10 pb-2">{category}</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {services.map((service) => (
                        <div key={service.id} className="rounded-xl border border-white/5 bg-white/[0.01] p-5 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          
                          {/* Left: Metadata descriptor */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 font-mono text-[9px] uppercase text-neutral-400">
                                {service.category}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono select-all">REF: {service.id}</span>
                            </div>
                            <h4 className="text-sm font-semibold text-white tracking-tight">{service.name}</h4>
                            {service.description && (
                              <div className="max-w-2xl pt-1">
                                {renderDescription(service.description)}
                              </div>
                            )}
                            
                            <div className="flex flex-wrap gap-4 text-[10px] font-mono text-neutral-500 pt-1">
                              <span>MIN ORDER: {service.min.toLocaleString()}</span>
                              <span>MAX ORDER: {service.max.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Right: Rates and Order shortlink */}
                          <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5">
                            <div>
                              <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Rate / 1,000 units</div>
                              <div className="text-xl font-bold font-mono text-white">₹{getInrRate(service)}</div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedCategory(service.category);
                                setSelectedServiceId(service.id);
                                setActiveTab('new-order');
                              }}
                              className="px-3 py-1.5 bg-white text-black font-semibold text-[11px] rounded-lg hover:bg-neutral-200 transition-all flex items-center"
                            >
                              Select Service
                              <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ADD FUNDS (Secure Deposit) */}
          {activeTab === 'funds' && (
            <div id="view-dashboard-funds" className="space-y-6">
              
              {/* Header Promo Banner */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-neutral-900 to-black p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white flex gap-1.5 items-center font-mono uppercase tracking-wider">
                    <CreditCard className="w-4 h-4" />
                    Secure Payment Gateway
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1 leading-normal">
                    Enter funds value below. Deposits are processed instantly to your wallet.
                  </p>
                </div>
                <div className="text-sm font-mono font-bold text-white bg-white/[0.04] px-4 py-2 border border-white/5 rounded-lg whitespace-nowrap">
                  Wallet Balance: ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {fundsNotification && (
                <div id="funds-notification-card" className="p-4 rounded-xl bg-neutral-900 border border-white/20 text-white text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-white shrink-0" />
                  <div>{fundsNotification}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Form Card (Screenshot 3 configuration!) */}
                <form id="add-funds-sim-form" onSubmit={handleAddFunds} className="md:col-span-7 rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-5">
                  
                  {/* Input and labels matching Screenshot 3 */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase font-mono tracking-wider">
                      Amount (INR)
                    </label>
                    <div className="relative">
                      <input
                        id="funds-amount-input"
                        type="number"
                        required
                        min="1"
                        max="100000"
                        step="1"
                        placeholder="e.g. 500"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-4 py-3 text-xs text-white rounded-xl bg-neutral-950 border border-white/10 focus:border-white focus:outline-none transition-all placeholder-neutral-600 font-mono font-bold"
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-neutral-500 font-sans">
                      Limits: ₹1 - ₹100,000
                    </p>
                  </div>

                  {/* Coupon Code Block */}
                  <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase font-mono tracking-wider">
                      Coupon Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="coupon-discount-input"
                        type="text"
                        placeholder="e.g. WELCOME10"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1 px-3 py-2.5 text-xs text-white rounded-lg bg-neutral-950 border border-white/10 uppercase font-mono font-bold focus:border-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-4 py-2.5 rounded-lg text-xs font-bold bg-neutral-800 text-white hover:bg-neutral-700 font-mono cursor-pointer transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    {couponValidationNotice && (
                      <p className="text-[10px] font-mono leading-tight text-neutral-300">
                        {couponValidationNotice}
                      </p>
                    )}
                    {appliedCoupon && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-200 font-mono font-bold">
                        <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        Activated: {appliedCoupon.code} (+{appliedCoupon.discount_percent}% extra bonus)
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      id="simulate-funds-btn"
                      type="submit"
                      className="w-full py-3.5 rounded-xl text-xs font-black bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all uppercase tracking-wider"
                    >
                      {appliedCoupon ? `Pay ₹${paymentAmount} to get ₹${Math.round(paymentAmount * (1 + appliedCoupon.discount_percent / 100))}` : 'Add Funds'}
                    </button>
                  </div>

                  {/* Supported Methods Subtext block matching Screenshot 3 bottom elements */}
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase font-mono tracking-wider text-center">
                      Supported Methods
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center space-y-1">
                        <span className="text-xs font-bold text-neutral-300 font-mono">UPI</span>
                        <span className="text-[9px] text-neutral-500">Auto instant QR</span>
                      </div>
                      <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center space-y-1">
                        <span className="text-xs font-bold text-neutral-300 font-mono">NETBANKING</span>
                        <span className="text-[9px] text-neutral-500">All Indian banks</span>
                      </div>
                      <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center space-y-1">
                        <span className="text-xs font-bold text-neutral-300 font-mono">CARDS</span>
                        <span className="text-[9px] text-neutral-500">Credit & Debit checkout</span>
                      </div>
                    </div>
                  </div>

                </form>

                {/* Info Card - Refund details repeated to emphasize "No Refund Policy" */}
                <div className="md:col-span-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 text-xs font-sans">
                  
                  <h3 className="font-semibold text-white uppercase font-mono tracking-wider text-neutral-300 pb-2 border-b border-white/[0.06]">
                    Policy
                  </h3>

                  <div className="space-y-3 leading-relaxed text-neutral-400">
                    <div className="p-3.5 rounded-xl bg-black text-[11px] border border-white/5 space-y-1.5">
                      <span className="font-semibold text-white block">📌 Non-Refundable:</span>
                      <p className="leading-normal">
                        Strict <span className="text-white font-bold underline">NO REFUND POLICY</span>. Once funds are deposited, they are irreversibly credited.
                      </p>
                    </div>
                  </div>

                </div>

              </div>

              {/* Individual Transaction History */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-neutral-400">
                  Your Transaction History
                </h3>
                {transactions.length === 0 ? (
                  <div className="border border-white/5 rounded-2xl bg-white/[0.01] p-8 text-center text-neutral-500 font-mono text-xs">
                    <CreditCard className="w-8 h-8 opacity-20 mx-auto mb-3 text-neutral-400" />
                    No transaction history recorded yet. Use the payment checkout above to add funds.
                  </div>
                ) : (
                  <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono min-w-[600px]">
                      <thead>
                        <tr className="bg-black/40 text-neutral-500 uppercase tracking-wider text-[9px]">
                          <th className="p-4">Tx ID</th>
                          <th className="p-4">Payment Method</th>
                          <th className="p-4 text-right">Amount</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {transactions.map((tx) => {
                          const isRefund = tx.method && tx.method.toLowerCase().includes('refund');
                          return (
                            <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-4 font-bold text-white text-[11px]">
                                {tx.id}
                              </td>
                              <td className="p-4 text-neutral-300">
                                {tx.method}
                              </td>
                              <td className={`p-4 text-right font-bold ${isRefund ? 'text-amber-400' : 'text-emerald-400'}`}>
                                ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-center">
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] uppercase font-bold border border-emerald-500/20">
                                  {tx.status || 'Success'}
                                </span>
                              </td>
                              <td className="p-4 text-right text-neutral-500 text-[10px]">
                                {new Date(tx.createdAt).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: WHATSAPP CUSTOMER SUPPORT */}
          {activeTab === 'support' && (
            <div id="view-dashboard-support" className="space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Support</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Contact us on WhatsApp for help.</p>
                </div>
              </div>

              <div className="max-w-xl mx-auto py-12">
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-black p-8 text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] -mr-10 -mt-10"></div>
                  
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/30">
                    <svg className="w-10 h-10 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider font-mono">WhatsApp</h3>
                    <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                      Fast, real-time communication via WhatsApp.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-neutral-300 font-mono">
                    <p>⏰ Average Response Time: &lt; 5 Minutes</p>
                    <p>🌍 Support Coverage: 24/7 Global</p>
                  </div>

                  <a
                    href="https://wa.me/919536678651"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  >
                    Message on WhatsApp
                  </a>
                  
                  <p className="text-[10px] text-neutral-500 uppercase font-mono tracking-widest">
                    Support
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: PROFILE DETAILS & DATABASE SETUP COVENANT */}
          {activeTab === 'profile' && (
            <div id="view-user-profile" className="space-y-6">
              
              {/* Profile Notice System */}
              {profileNotice && (
                <div id="profile-success-alert" className="p-4 rounded-xl border border-white/20 bg-neutral-900 text-white text-xs flex items-center gap-2 font-mono animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  <span>{profileNotice}</span>
                </div>
              )}

              {/* Profile Overview Header */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-6 rounded-xl border border-white/10 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900">
                <img
                  src={userProfilePic}
                  alt={session.name}
                  className="w-16 h-16 rounded-full border-2 border-white/20 shadow-lg"
                />
                <div className="text-center sm:text-left space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-white tracking-tight">{session.name}</h2>
                    <span className="px-2 py-0.5 roundedbg-neutral-800 text-[9px] font-mono font-bold uppercase text-neutral-400 border border-white/5">
                      Member
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono">{session.email}</p>
                  <p className="text-[10px] text-neutral-500">Google Login • INR</p>
                </div>
              </div>

              {/* Account and API Token Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Visual Tokens Ledger */}
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] space-y-4">
                  <h3 className="text-xs font-semibold text-white uppercase font-mono tracking-wider">Account Settings</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between pb-1.5 border-b border-white/[0.04]">
                      <span className="text-neutral-500">Login Method</span>
                      <span className="text-neutral-300 font-semibold font-mono">Google Account</span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-white/[0.04]">
                      <span className="text-neutral-500">Currency</span>
                      <span className="text-neutral-300 font-mono font-semibold">Indian Rupees (INR)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Account Balance</span>
                      <span className="text-white font-mono font-bold">₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 8: ADMIN CONTROL PANEL (Authorized admins only) */}
          {activeTab === 'admin' && (
            <div id="view-admin-portal" className="space-y-6">
              
              {/* Core branding and header */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900 to-black p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[90px] -mr-20 -mt-20"></div>
                <div className="relative z-10">
                  <span className="text-[9px] font-mono font-bold tracking-widest text-red-500 bg-red-500/10 px-2.5 py-1 rounded-md uppercase">
                    Admin Active
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-display font-black text-white mt-3 uppercase tracking-tighter">
                    Admin Panel
                  </h1>
                  <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-normal">
                    Manage users, settings, and orders.
                  </p>
                </div>
              </div>

              {/* Bento Grid Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-1">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Users</span>
                  <p className="text-xl font-bold text-white font-mono">{adminUsers.length || 2}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-1">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Markup %</span>
                  <p className="text-xl font-bold text-white font-mono">{globalSettings.profit_markup_percent}%</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-1">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Coupons</span>
                  <p className="text-xl font-bold text-white font-mono">{adminCoupons.length || 3}</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-1">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Orders</span>
                  <p className="text-xl font-bold text-white font-mono">{adminOrders.length || orders.length}</p>
                </div>
              </div>

              {/* Horizontal Tab controller inside Admin Workspace */}
              <div className="flex border-b border-white/10 gap-1 overflow-x-auto pb-px">
                <button
                  onClick={() => setAdminSubTab('users')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all whitespace-nowrap ${
                    adminSubTab === 'users' ? 'border-red-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  Manage Users
                </button>
                <button
                  onClick={() => setAdminSubTab('settings')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all whitespace-nowrap ${
                    adminSubTab === 'settings' ? 'border-red-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  Markup & Video Links
                </button>
                <button
                  onClick={() => setAdminSubTab('coupons')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all whitespace-nowrap ${
                    adminSubTab === 'coupons' ? 'border-red-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  Coupon Engine
                </button>
                <button
                  onClick={() => setAdminSubTab('transactions')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono border-b-2 transition-all whitespace-nowrap ${
                    adminSubTab === 'transactions' ? 'border-red-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  Transactions & Orders Logs
                </button>
              </div>

              {/* Subtab Renderers */}
              {adminLoading ? (
                <div className="p-12 text-center text-xs font-mono text-neutral-500 animate-pulse">
                  Querying database synchronization pipeline...
                </div>
              ) : (
                <>
                  {/* SUBTAB 1: USERS */}
                  {adminSubTab === 'users' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                          <div>
                            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Registered Client Registries</h3>
                            <p className="text-[10px] text-neutral-400 mt-1">Directly adjust client balance parameters or shift administration authorizations.</p>
                          </div>
                          <button
                            onClick={fetchAdminData}
                            className="text-[10px] px-3 py-1 bg-white/5 border border-white/10 rounded-md font-mono hover:bg-white/10"
                          >
                            Sync Database
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="text-neutral-500 border-b border-white/5 uppercase text-[9px] tracking-wider">
                                <th className="pb-3 pt-1">User Identifier / Email</th>
                                <th className="pb-3 pt-1">Profile Name</th>
                                <th className="pb-3 pt-1 text-right">Current Balance</th>
                                <th className="pb-3 pt-1 text-center">Admin privileges</th>
                                <th className="pb-3 pt-1 text-right">Fund Adjuster (Set INR)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-neutral-300">
                              {adminUsers.map((user, idx) => (
                                <tr key={user.email || idx} className="hover:bg-white/[0.02]">
                                  <td className="py-3.5 pr-2 font-bold select-all">{user.email}</td>
                                  <td className="py-3.5 pr-2 text-neutral-400">{user.name || 'Anonymous User'}</td>
                                  <td className="py-3.5 pr-2 text-right font-bold text-white">
                                    ₹{(typeof user.balance === 'number' ? user.balance : parseFloat(user.balance || '0')).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3.5 text-center">
                                    <button
                                      onClick={() => handleToggleAdminStatus(user.email, !!user.is_admin)}
                                      className={`px-2 py-1 text-[9px] rounded font-bold ${
                                        user.is_admin ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-white/5 text-neutral-400 hover:text-white'
                                      }`}
                                    >
                                      {user.is_admin ? 'ADMINISTRATOR' : 'CLIENT'}
                                    </button>
                                  </td>
                                  <td className="py-3.5 text-right">
                                    <input
                                      type="number"
                                      placeholder="Set input"
                                      defaultValue={user.balance}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleChangeBalance(user.email, (e.target as HTMLInputElement).value);
                                        }
                                      }}
                                      className="w-24 px-2 py-1 rounded bg-black border border-white/10 text-right text-xs focus:border-white focus:outline-none"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 2: TUNABLES (MARKUP & VIDEO) */}
                  {adminSubTab === 'settings' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider text-red-500">Provider API Synchronization</h3>
                            <p className="text-[10px] text-neutral-400 mt-1">Sync your services and categories directly with the provider.</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (confirm('Sync all services from API?')) {
                                  refreshServices(true).then(success => {
                                    if (success) alert('Sync Complete');
                                    else alert('Sync Failed');
                                  });
                                }
                              }}
                              disabled={refreshingServices}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-mono font-bold text-white transition-all uppercase flex items-center gap-2"
                            >
                              <RefreshCw className={`w-3 h-3 ${refreshingServices ? 'animate-spin' : ''}`} />
                              {refreshingServices ? 'Syncing...' : 'Sync Services'}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('FORCE RESET will delete and re-import all services. Continue?')) {
                                  // Call the admin sync endpoint directly for force reset
                                  fetch(`${API_BASE}/api/smm/admin/services/sync`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ force_reset: true })
                                  })
                                  .then(r => r.json())
                                  .then(d => {
                                    if (d.success) { alert('Force Reset Successful'); refreshServices(false); }
                                    else alert('Force Reset Failed: ' + d.error);
                                  })
                                  .catch(() => alert('Force Reset Connection Failed'));
                                }
                              }}
                              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-[10px] font-mono font-bold text-red-400 transition-all uppercase flex items-center gap-2"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Force Reset
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Profit Markup controller */}
                      <form onSubmit={handleSaveSettings} className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-5">
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Dynamic Pricing Markup</h3>
                          <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                            Set your markup percentage. When services are retrieved from the provider API, our site adds this markup to calculate the final end-user rate.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">Margin Percent Markup</label>
                          <div className="flex gap-4 items-center">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={editMarkup}
                              onChange={(e) => setEditMarkup(parseInt(e.target.value, 10))}
                              className="flex-1 accent-white"
                            />
                            <span className="text-base font-mono font-bold text-white w-12 text-right">{editMarkup}%</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">Formula Breakdown Indicator</label>
                          <div className="p-3.5 rounded-xl bg-black border border-white/5 space-y-1.5 font-sans text-[11px] text-neutral-400 leading-normal">
                            <div>• Provider Base Price (for ₹100 API cost) = <strong>₹100</strong></div>
                            <div>• Your User Will Pay = ₹100 + {editMarkup}% Markup = <strong>₹{(100 * (1 + editMarkup/100))}</strong></div>
                            <div>• Net Profit Margin = <strong>{editMarkup}%</strong></div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-black uppercase transition-colors"
                        >
                          Overrule and Save Margin
                        </button>

                        {settingsStatus && (
                          <p className="text-xs font-mono text-center text-emerald-400">{settingsStatus}</p>
                        )}
                      </form>

                      {/* Video URL update form */}
                      <form onSubmit={handleSaveSettings} className="rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-5">
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Landing Page Showcase Video</h3>
                          <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                            Directly alter the YouTube embed source link. This dynamically switches the guides showcase player shown on the front landing gates of FollowLike.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">YouTube Embed URL</label>
                          <input
                            type="text"
                            value={editVideoUrl}
                            onChange={(e) => setEditVideoUrl(e.target.value)}
                            placeholder="e.g. https://www.youtube.com/embed/dQw4w9WgXcQ"
                            className="w-full px-4 py-3 text-xs text-white rounded-xl bg-neutral-950 border border-white/10 focus:border-white focus:outline-none font-mono"
                          />
                        </div>

                        <div className="p-3 bg-black border border-white/5 rounded-xl space-y-1 text-[10px] font-mono leading-relaxed text-neutral-400">
                          <span className="font-bold text-white">Embed Hint rules:</span>
                          <p>URLs MUST use the watch form replaced with "/embed/" format. E.g. <em>https://www.youtube.com/embed/&lt;id&gt;?autoplay=0&amp;mute=1</em></p>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-black uppercase transition-colors"
                        >
                          Modify Global Exhibition Video
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                  {/* SUBTAB 3: COUPONS ENGINE */}
                  {adminSubTab === 'coupons' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* Coupon Creator */}
                      <form onSubmit={handleCreateCoupon} className="lg:col-span-5 rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-4">
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Build Bonus Coupon code</h3>
                          <p className="text-[10px] text-neutral-400 mt-1">Design an auto-expiry deposit bonus code below structure parameters.</p>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">Coupon Code String</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. WELCOME10"
                            value={newCouponCode}
                            onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 text-xs text-white rounded-lg bg-neutral-950 border border-white/10 uppercase font-mono font-bold"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">Deposit Bonus %</label>
                            <input
                              type="number"
                              required
                              min="1"
                              max="100"
                              value={newCouponDiscount}
                              onChange={(e) => setNewCouponDiscount(parseInt(e.target.value, 10))}
                              className="w-full px-3 py-2 text-xs text-white rounded-lg bg-neutral-950 border border-white/10 font-mono"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">Max Claims count</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={newCouponMaxUses}
                              onChange={(e) => setNewCouponMaxUses(parseInt(e.target.value, 10))}
                              className="w-full px-3 py-2 text-xs text-white rounded-lg bg-neutral-950 border border-white/10 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">Auto-expiry date deadline</label>
                          <input
                            type="date"
                            required
                            value={newCouponExpiry}
                            onChange={(e) => setNewCouponExpiry(e.target.value)}
                            className="w-full px-3 py-2 text-xs text-white rounded-lg bg-neutral-950 border border-white/10 font-mono"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 rounded-xl bg-white text-black font-mono font-bold text-xs uppercase hover:bg-neutral-200 transition-colors"
                        >
                          Generate Code Now
                        </button>
                      </form>

                      {/* Active Coupons list */}
                      <div className="lg:col-span-7 rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-4">
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Active Promotional Campaign codes</h3>
                          <p className="text-[10px] text-neutral-400 mt-1">Codes validated for addition sequence bonus funds. Expires automatically following date limit threshold.</p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="text-neutral-500 border-b border-white/5 uppercase text-[9px] tracking-wider">
                                <th className="pb-2.5">Code</th>
                                <th className="pb-2.5 text-center">Bonus %</th>
                                <th className="pb-2.5 text-center">Ratios (Used)</th>
                                <th className="pb-2.5">Auto-Expiry Limit</th>
                                <th className="pb-2.5 text-right">Delete</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-neutral-300">
                              {adminCoupons.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="py-6 text-center text-neutral-500">
                                    No promotional coupons active. Create one with the creator panel.
                                  </td>
                                </tr>
                              ) : (
                                adminCoupons.map((coupon, idx) => {
                                  const isExpired = new Date(coupon.expires_at).getTime() < Date.now();
                                  return (
                                    <tr key={coupon.code || idx} className="hover:bg-white/[0.02]">
                                      <td className="py-3 font-bold uppercase">{coupon.code}</td>
                                      <td className="py-3 text-center text-emerald-400">{coupon.discount_percent}% EXTRA</td>
                                      <td className="py-3 text-center text-neutral-400">
                                        {coupon.used_count || 0} / {coupon.max_uses}
                                      </td>
                                      <td className="py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isExpired ? 'bg-red-500/10 text-red-400 border border-red-500/15' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                                        }`}>
                                          {new Date(coupon.expires_at).toLocaleDateString()} {isExpired ? '(EXPIRED)' : ''}
                                        </span>
                                      </td>
                                      <td className="py-3 text-right">
                                        <button
                                          onClick={() => handleDeleteCoupon(coupon.code)}
                                          className="text-red-400 hover:text-white px-2 py-1 hover:bg-red-500/10 rounded"
                                        >
                                          Deactivate
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* SUBTAB 4: TRANSACTION & ORDER AUDITS */}
                  {adminSubTab === 'transactions' && (
                    <div className="space-y-6">
                      
                      {/* Transactions History */}
                      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Network Billing Ledgers</h3>
                          <p className="text-[10px] text-neutral-400 mt-1">Audit of deposits and currency credits registered across the system.</p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="text-neutral-500 border-b border-white/5 uppercase text-[9px] tracking-wider">
                                <th className="pb-2.5">Tx ID</th>
                                <th className="pb-2.5">User Email</th>
                                <th className="pb-2.5 text-right font-bold">Sum Credited</th>
                                <th className="pb-2.5">Method Gateway details</th>
                                <th className="pb-2.5 text-right">Time Log</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-neutral-300">
                              {adminTransactions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="py-6 text-center text-neutral-500">
                                    No database deposits recorded yet. Try topup via standard funds view.
                                  </td>
                                </tr>
                              ) : (
                                [...adminTransactions]
                                  .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
                                  .map((tx, idx) => (
                                    <tr key={tx.id || idx} className="hover:bg-white/[0.02]">
                                      <td className="py-3 font-bold select-all text-neutral-400">{tx.id}</td>
                                      <td className="py-3 text-neutral-300">{tx.user_email || 'gauravbeniwal30003@gmail.com'}</td>
                                      <td className="py-3 text-right font-bold text-white">₹{parseFloat(tx.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                      <td className="py-3 text-neutral-400 truncate max-w-xs">{tx.method}</td>
                                      <td className="py-3 text-right text-neutral-500">
                                        {new Date(tx.created_at || tx.createdAt).toLocaleDateString()} {new Date(tx.created_at || tx.createdAt).toLocaleTimeString()}
                                      </td>
                                    </tr>
                                  ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Orders Pipelines */}
                      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Order Pipeline Audits</h3>
                          <p className="text-[10px] text-neutral-400 mt-1">Status logs of orders processed across the network.</p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="text-neutral-500 border-b border-white/5 uppercase text-[9px] tracking-wider">
                                <th className="pb-2.5">Internal Ref</th>
                                <th className="pb-2.5">Provider ID</th>
                                <th className="pb-2.5">User</th>
                                <th className="pb-2.5">Service Code</th>
                                <th className="pb-2.5">Target Link</th>
                                <th className="pb-2.5 text-right font-bold">Price Charged</th>
                                <th className="pb-2.5 text-right">Fulfillment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-neutral-300">
                              {adminOrders.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="py-6 text-center text-neutral-500">
                                    No orders submitted to the provider interface yet.
                                  </td>
                                </tr>
                              ) : (
                                adminOrders.map((ord, idx) => (
                                  <tr key={ord.id || idx} className="hover:bg-white/[0.02]">
                                    <td className="py-3 font-bold text-white">{ord.id}</td>
                                    <td className="py-3 font-bold select-all text-neutral-400">
                                      {ord.provider_order_id || ord.providerOrderId || 'Processing...'}
                                    </td>
                                    <td className="py-3 text-neutral-400 truncate max-w-[120px]">{ord.user_email || ord.userEmail}</td>
                                    <td className="py-3 text-neutral-400 truncate max-w-[160px]">{ord.service_name || ord.serviceName || `Service #${ord.service_id || ord.serviceId || '?'}`}</td>
                                    <td className="py-3 font-semibold text-neutral-400 select-all truncate max-w-[140px] underline hover:text-white">
                                      <a href={ord.target_url || ord.targetUrl} target="_blank" rel="noreferrer">
                                        {ord.target_url || ord.targetUrl}
                                      </a>
                                    </td>
                                    <td className="py-3 text-right font-bold text-emerald-400">
                                      ₹{parseFloat(ord.charge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-3 text-right">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        ord.status === 'Completed' || ord.status === 'Success'
                                          ? 'bg-neutral-800 text-white border border-white/10'
                                          : ord.status === 'In Progress'
                                          ? 'bg-neutral-800 text-white animate-pulse'
                                          : ord.status === 'Cancelled'
                                          ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                                          : 'bg-neutral-900 text-neutral-400'
                                      }`}>
                                        {ord.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}
                </>
              )}

            </div>
          )}
          {activeTab === 'menu' && (
            <div id="view-mobile-directory-menu" className="space-y-6 md:hidden">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900 to-black p-5">
                <h2 className="text-base font-semibold text-white tracking-tight">Navigation Menu</h2>
                <p className="text-xs text-neutral-400 mt-1">Browse available services, contact customer support, or check your account details.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('home')}
                  className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-left transition-all space-y-3 flex flex-col justify-between"
                >
                  <Globe className="w-6 h-6 text-neutral-400 animate-loop-spin-slow" />
                  <div>
                    <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">Home</h3>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-normal">View your account summary and quick statistics.</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('services')}
                  className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-left transition-all space-y-3 flex flex-col justify-between"
                >
                  <Layers className="w-6 h-6 text-neutral-400 animate-loop-float" />
                  <div>
                    <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">Services & Pricing</h3>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-normal">View all list prices and order limits.</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('support')}
                  className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-left transition-all space-y-3 flex flex-col justify-between"
                >
                  <MessageSquare className="w-6 h-6 text-neutral-400 animate-loop-wiggle" />
                  <div>
                    <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">WhatsApp</h3>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-normal">Contact our support team directly.</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] text-left transition-all space-y-3 flex flex-col justify-between"
                >
                  <User className="w-6 h-6 text-neutral-400 animate-loop-breathe" />
                  <div>
                    <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">Account</h3>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-normal">View account details and database setup SQL.</p>
                  </div>
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 text-center mt-4">
                <button
                  onClick={onLogout}
                  className="w-full py-2.5 rounded-lg border border-red-950 bg-red-950/10 hover:bg-red-950/30 text-red-300 text-xs font-bold font-mono uppercase transition-all"
                >
                  Log Out
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MOBILE FIXED BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10 md:hidden pb-safe">
        <div className="relative flex justify-around items-center h-16 px-2">
          
          {/* Menu Option */}
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 text-center py-1 flex flex-col items-center justify-center transition-all ${
              activeTab === 'menu' ? 'text-white font-bold' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Menu className="w-5 h-5 animate-loop-float" />
            <span className="text-[10px] mt-1 tracking-tight font-sans font-bold">Menu</span>
          </button>

          {/* Orders Option */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 text-center py-1 flex flex-col items-center justify-center transition-all ${
              activeTab === 'orders' ? 'text-white font-bold' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Clock className="w-5 h-5 animate-loop-clock" />
            <span className="text-[10px] mt-1 tracking-tight font-sans font-bold">Orders</span>
          </button>

          {/* Big Middle Protruding "+" Option */}
          <div className="flex-1 text-center relative h-full">
            <button
              onClick={() => setActiveTab('new-order')}
              className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-[0_-2px_10px_rgba(255,255,255,0.2),0_4px_10px_rgba(0,0,0,0.5)] border-4 border-black transition-all hover:scale-110 active:scale-95 cursor-pointer"
            >
              <Plus className="w-6 h-6 animate-loop-pulse-gentle" strokeWidth={3} />
            </button>
          </div>

          {/* Add Funds Option */}
          <button
            onClick={() => setActiveTab('funds')}
            className={`flex-1 text-center py-1 flex flex-col items-center justify-center transition-all ${
              activeTab === 'funds' ? 'text-white font-bold' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <CreditCard className="w-5 h-5 animate-loop-card" />
            <span className="text-[10px] mt-1 tracking-tight font-sans font-bold">Add Funds</span>
          </button>

          {/* Account Option */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 text-center py-1 flex flex-col items-center justify-center transition-all ${
              activeTab === 'profile' ? 'text-white font-bold' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <User className="w-5 h-5 animate-loop-breathe" />
            <span className="text-[10px] mt-1 tracking-tight font-sans font-bold">Account</span>
          </button>

        </div>
      </div>

      {/* DASHBOARD BOTTOM FOOTER (Mini copyright) */}
      <footer className="mt-auto border-t border-white/[0.05] py-6 text-center text-[10px] text-neutral-500 font-mono">
        <div>FOLLOWLIKE EVERYWHERE • Safe & Secured Panel</div>
        <div className="mt-1">Handcrafted in complete compliance with Black & White aesthetics.</div>
      </footer>
    </div>
  );
}
