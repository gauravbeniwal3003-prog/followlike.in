import { API_BASE } from '../config';
import React, { useState, useEffect } from 'react';
import { UserSession, SMMService } from '../types';
import { 
  Users, BarChart3, Settings, ShieldCheck, DollarSign, LayoutList, Layers, 
  Search, Edit, StopCircle, PlayCircle, RefreshCw, X, Check, Save, Plus, Trash2, Eye, EyeOff
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function AdminPanel({ session, globalSettings, onUpdateSettings, refreshServices }: any) {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // Dashboard Data
  const [dashboardStats, setDashboardStats] = useState<any>({});
  // Users Data
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Transactions Data
  const [transactions, setTransactions] = useState<any[]>([]);
  // Margin Data
  const [globalMargin, setGlobalMargin] = useState(globalSettings.profit_markup_percent);
  // Settings Data
  const [landingVideo, setLandingVideo] = useState(globalSettings.landing_video_url);
  // SMM Provider Data
  const [smmApiKey, setSmmApiKey] = useState(globalSettings.smm_api_key || '');
  const [smmApiUrl, setSmmApiUrl] = useState(globalSettings.smm_api_url || '');

  useEffect(() => {
    if (globalSettings) {
      setGlobalMargin(globalSettings.profit_markup_percent);
      setLandingVideo(globalSettings.landing_video_url);
      setSmmApiKey(globalSettings.smm_api_key || '');
      setSmmApiUrl(globalSettings.smm_api_url || '');
    }
  }, [globalSettings]);
  // Category / Service Data
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, any>>({});
  const [serviceOverrides, setServiceOverrides] = useState<Record<string, any>>({});
  const [adminServices, setAdminServices] = useState<any[]>([]);
  const [adminCategories, setAdminCategories] = useState<any[]>([]);
  const [providerBalance, setProviderBalance] = useState<{ balance: string; currency: string } | null>(null);
  const [providerError, setProviderError] = useState<string>('');
  const [allServices, setAllServices] = useState<SMMService[]>([]);

  // Category CRUD states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormCustomName, setCatFormCustomName] = useState('');
  const [catFormCustomMargin, setCatFormCustomMargin] = useState('');
  const [catFormSortOrder, setCatFormSortOrder] = useState('0');
  const [catFormIsActive, setCatFormIsActive] = useState(true);
  const [catSearchQuery, setCatSearchQuery] = useState('');

  // Service CRUD states
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [srvFormId, setSrvFormId] = useState('');
  const [srvFormCategoryName, setSrvFormCategoryName] = useState('');
  const [srvFormApiName, setSrvFormApiName] = useState('');
  const [srvFormCustomName, setSrvFormCustomName] = useState('');
  const [srvFormCustomDescription, setSrvFormCustomDescription] = useState('');
  const [srvFormProviderRate, setSrvFormProviderRate] = useState('');
  const [srvFormCustomMargin, setSrvFormCustomMargin] = useState('');
  const [srvFormMinOrder, setSrvFormMinOrder] = useState('');
  const [srvFormMaxOrder, setSrvFormMaxOrder] = useState('');
  const [srvFormType, setSrvFormType] = useState('Default');
  const [srvFormRefill, setSrvFormRefill] = useState(false);
  const [srvFormIsActive, setSrvFormIsActive] = useState(true);

  // Search & filter states for services
  const [srvSearchQuery, setSrvSearchQuery] = useState('');
  const [srvFilterCategory, setSrvFilterCategory] = useState('');
  const [srvFilterStatus, setSrvFilterStatus] = useState('all');

  // Open edit / create modals helpers
  const openCategoryEdit = (catItem: any) => {
    setEditingCategory(catItem);
    setCatFormName(catItem.name);
    setCatFormCustomName(catItem.custom_name || '');
    setCatFormCustomMargin(catItem.custom_margin !== null && catItem.custom_margin !== undefined ? catItem.custom_margin.toString() : '');
    setCatFormSortOrder(catItem.sort_order !== null && catItem.sort_order !== undefined ? catItem.sort_order.toString() : '0');
    setCatFormIsActive(catItem.is_active !== false);
    setIsCategoryModalOpen(true);
  };

  const openCategoryCreate = () => {
    setEditingCategory(null);
    setCatFormName('');
    setCatFormCustomName('');
    setCatFormCustomMargin('');
    setCatFormSortOrder('0');
    setCatFormIsActive(true);
    setIsCategoryModalOpen(true);
  };

  const openServiceEdit = (srvItem: any) => {
    setEditingService(srvItem);
    setSrvFormId(srvItem.service_id.toString());
    setSrvFormCategoryName(srvItem.category_name);
    setSrvFormApiName(srvItem.api_name);
    setSrvFormCustomName(srvItem.custom_name || '');
    setSrvFormCustomDescription(srvItem.custom_description || '');
    setSrvFormCustomMargin(srvItem.custom_margin !== null && srvItem.custom_margin !== undefined ? srvItem.custom_margin.toString() : '');
    setSrvFormProviderRate(srvItem.provider_rate !== null && srvItem.provider_rate !== undefined ? srvItem.provider_rate.toString() : '0');
    setSrvFormMinOrder(srvItem.min_order !== null && srvItem.min_order !== undefined ? srvItem.min_order.toString() : '10');
    setSrvFormMaxOrder(srvItem.max_order !== null && srvItem.max_order !== undefined ? srvItem.max_order.toString() : '10000');
    setSrvFormType(srvItem.type || 'Default');
    setSrvFormRefill(!!srvItem.refill);
    setSrvFormIsActive(srvItem.is_active !== false);
    setIsServiceModalOpen(true);
  };

  const openServiceCreate = () => {
    setEditingService(null);
    setSrvFormId('');
    setSrvFormCategoryName(adminCategories[0]?.name || '');
    setSrvFormApiName('');
    setSrvFormCustomName('');
    setSrvFormCustomDescription('');
    setSrvFormCustomMargin('');
    setSrvFormProviderRate('0');
    setSrvFormMinOrder('10');
    setSrvFormMaxOrder('10000');
    setSrvFormType('Default');
    setSrvFormRefill(false);
    setSrvFormIsActive(true);
    setIsServiceModalOpen(true);
  };

  // CRUD actions handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingCategory 
      ? `${API_BASE}/api/smm/admin/categories/update` 
      : `${API_BASE}/api/smm/admin/categories/create`;
    
    try {
      const payload = {
        name: catFormName,
        custom_name: catFormCustomName || null,
        custom_margin: catFormCustomMargin ? parseFloat(catFormCustomMargin) : null,
        sort_order: catFormSortOrder ? parseInt(catFormSortOrder) : 0,
        is_active: catFormIsActive
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsCategoryModalOpen(false);
        fetchCategories();
        if (refreshServices) refreshServices(false);
      } else {
        alert('Failed to save category: ' + data.error);
      }
    } catch (err: any) {
      alert('Error saving category: ' + err.message);
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the category "${name}"? This will delete all associated services as well.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/smm/admin/categories/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        fetchCategories();
        fetchServices();
        if (refreshServices) refreshServices(true);
      } else {
        alert('Failed to delete: ' + data.error);
      }
    } catch (err: any) {
      alert('Error deleting: ' + err.message);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingService 
      ? `${API_BASE}/api/smm/admin/services/update` 
      : `${API_BASE}/api/smm/admin/services/create`;

    try {
      const payload = {
        service_id: parseInt(srvFormId),
        category_name: srvFormCategoryName,
        api_name: srvFormApiName,
        custom_name: srvFormCustomName || null,
        custom_description: srvFormCustomDescription || null,
        provider_rate: srvFormProviderRate ? parseFloat(srvFormProviderRate) : 0,
        custom_margin: srvFormCustomMargin ? parseFloat(srvFormCustomMargin) : null,
        min_order: srvFormMinOrder ? parseInt(srvFormMinOrder) : 10,
        max_order: srvFormMaxOrder ? parseInt(srvFormMaxOrder) : 10000,
        type: srvFormType || 'Default',
        refill: srvFormRefill,
        is_active: srvFormIsActive
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsServiceModalOpen(false);
        fetchServices();
        if (refreshServices) refreshServices(false);
      } else {
        alert('Failed to save service: ' + data.error);
      }
    } catch (err: any) {
      alert('Error saving service: ' + err.message);
    }
  };

  const handleDeleteService = async (service_id: number) => {
    if (!confirm(`Are you sure you want to delete service ID ${service_id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/smm/admin/services/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id })
      });
      const data = await res.json();
      if (data.success) {
        fetchServices();
        if (refreshServices) refreshServices(false);
      } else {
        alert('Failed to delete service: ' + data.error);
      }
    } catch (err: any) {
      alert('Error deleting service: ' + err.message);
    }
  };

  useEffect(() => {
    // Check local storage for admin auth token
    const token = localStorage.getItem('smm_admin_token');
    if (token) {
      setIsAdminAuthenticated(true);
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/smm/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('smm_admin_token', data.token);
        setIsAdminAuthenticated(true);
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setAuthError('Connection failed.');
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('smm_admin_token');
    setIsAdminAuthenticated(false);
  };

  // Fetch logic
  useEffect(() => {
    if (!isAdminAuthenticated) return;
    fetchDashboard();
    fetchUsers();
    fetchTransactions();
    fetchCategories();
    fetchServices();
    fetchProviderBalance();
    
    // Also fetch the standard services list to have the catalog
    fetch(`${API_BASE}/api/smm/services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }})
      .then(r => r.json())
      .then(d => { if (d.success) setAllServices(d.services || []) });
  }, [isAdminAuthenticated]);

  const fetchDashboard = () => fetch(`${API_BASE}/api/smm/admin/dashboard`).then(r => r.json()).then(d => { if (d.success) setDashboardStats(d.stats) });
  const fetchUsers = () => fetch(`${API_BASE}/api/smm/admin/users`).then(r => r.json()).then(d => { if (d.success) setUsers(d.users) });
  const fetchTransactions = () => fetch(`${API_BASE}/api/smm/admin/transactions`).then(r => r.json()).then(d => { if(d.success) setTransactions(d.transactions || []) });
  const fetchProviderBalance = () => {
    setProviderError('');
    fetch(`${API_BASE}/api/smm/admin/provider-balance`)
      .then(r => r.json())
      .then(d => { 
        if (d.success) {
          setProviderBalance({ balance: d.balance, currency: d.currency });
        } else {
          setProviderError(d.error || 'Connection failed');
        }
      })
      .catch(err => {
        setProviderError(err.message || 'Network error');
      });
  };
  const fetchCategories = () => fetch(`${API_BASE}/api/smm/admin/categories`).then(r => r.json()).then(d => { 
    if(d.success) {
      setCategoryOverrides(d.categoryOverrides || {});
      setAdminCategories(d.categories || []);
    }
  });
  const fetchServices = () => fetch(`${API_BASE}/api/smm/admin/services`).then(r => r.json()).then(d => { 
    if(d.success) {
      setServiceOverrides(d.serviceOverrides || {});
      setAdminServices(d.services || []);
    }
  });

  const Header = () => (
    <div className="flex flex-col sm:flex-row justify-between items-center sm:items-center bg-black border-b border-white/5 p-4 sticky top-0 z-50 gap-4 sm:gap-0">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
        <h1 className="text-lg sm:text-xl font-bold font-mono uppercase tracking-widest text-white text-center sm:text-left">Admin Command Center</h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <button onClick={handleAdminLogout} className="flex-1 sm:flex-none text-center px-4 py-2 text-neutral-400 hover:text-white rounded-lg text-[10px] sm:text-xs font-mono font-bold transition-all uppercase">
          Logout
        </button>
        <NavLink to="/" className="flex-1 sm:flex-none text-center px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition-all uppercase">
          Exit to App
        </NavLink>
      </div>
    </div>
  );

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans">
        <div className="p-8 border border-white/10 bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] -mr-10 -mt-10"></div>
          <div className="flex flex-col items-center mb-8 relative z-10">
            <ShieldCheck className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-2xl font-black text-white uppercase tracking-wider">Admin Login</h2>
            <p className="text-xs text-neutral-400 mt-2 font-mono text-center">Authorized personnel only</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4 relative z-10">
            {authError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-mono">{authError}</div>}
            <div>
              <input 
                type="text" 
                placeholder="Username" 
                value={authUsername}
                onChange={e => setAuthUsername(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white font-mono text-sm focus:border-red-500/50 focus:outline-none transition-colors"
                required
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password" 
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white font-mono text-sm focus:border-red-500/50 focus:outline-none transition-colors"
                required
              />
            </div>
            <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl uppercase tracking-widest text-sm transition-colors mt-4">
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  const Navigation = () => {
    const tabs = [
      { id: 'dashboard', label: 'Dashboard', short: 'Dash', icon: <BarChart3 className="w-5 h-5 md:w-4 md:h-4" /> },
      { id: 'users', label: 'Manage Users', short: 'Users', icon: <Users className="w-5 h-5 md:w-4 md:h-4" /> },
      { id: 'transactions', label: 'Transactions', short: 'Trans', icon: <DollarSign className="w-5 h-5 md:w-4 md:h-4" /> },
      { id: 'margins', label: 'System Settings', short: 'Settings', icon: <Settings className="w-5 h-5 md:w-4 md:h-4" /> },
      { id: 'categories', label: 'Category Management', short: 'Categories', icon: <Layers className="w-5 h-5 md:w-4 md:h-4" /> },
      { id: 'services', label: 'Service Management', short: 'Services', icon: <LayoutList className="w-5 h-5 md:w-4 md:h-4" /> },
    ];
    return (
      <>
        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-64 border-r border-white/5 bg-black/50 overflow-y-auto px-4 py-6 flex-col gap-2 relative z-10 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all uppercase tracking-wider ${
                activeTab === t.id ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-neutral-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/95 backdrop-blur-xl z-50 px-2 py-2 flex items-center justify-between overflow-x-auto gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center justify-center gap-1.5 p-2 min-w-[60px] rounded-xl transition-all ${
                activeTab === t.id ? 'text-red-500' : 'text-neutral-500 hover:text-white'
              }`}
            >
              {t.icon}
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-center leading-tight">
                {t.short}
              </span>
            </button>
          ))}
        </div>
      </>
    );
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900 to-black p-6 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[90px] -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white font-display tracking-tight">System Overview</h2>
          <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest font-mono">Live synchronization with provider active</p>
        </div>
        <div className="flex gap-2 relative z-10">
          <button 
            onClick={() => {
              if (confirm('Regular sync will update all active services from the provider. Continue?')) {
                setIsSyncing(true);
                fetch(`${API_BASE}/api/smm/admin/services/sync`, { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                })
                  .then(r => r.json())
                  .then(d => { 
                    if (d.success) {
                      alert(`Sync Complete! ${d.count} services processed.`);
                      fetchDashboard(); 
                      fetchServices(); 
                      fetchCategories();
                      if (refreshServices) refreshServices(false);
                    } else {
                      alert('Sync Error: ' + (d.error || 'Unknown error'));
                    }
                  })
                  .catch(e => alert('Sync failed connection.'))
                  .finally(() => setIsSyncing(false));
              }
            }}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-mono font-bold text-white transition-all uppercase ${isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /> 
            {isSyncing ? 'Syncing...' : 'Sync API Updates'}
          </button>
          <button 
            onClick={() => {
              if (confirm('WARNING: Force sync will delete all categories and services and re-fetch them from scratch. Proceed?')) {
                setIsSyncing(true);
                fetch(`${API_BASE}/api/smm/admin/services/sync`, { 
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ force_reset: true })
                })
                  .then(r => r.json())
                  .then(d => { 
                    if (d.success) {
                      alert(`Force Sync Complete! ${d.count} services re-imported.`);
                      fetchDashboard(); 
                      fetchServices(); 
                      fetchCategories();
                      if (refreshServices) refreshServices(true);
                    } else {
                      alert('Force Sync Error: ' + (d.error || 'Unknown error'));
                    }
                  })
                  .catch(e => alert('Force sync failed connection.'))
                  .finally(() => setIsSyncing(false));
              }
            }}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-mono font-bold text-red-500 transition-all uppercase ${isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500/30'}`}
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Processing...' : 'Force Reset Sync'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: dashboardStats.totalUsers || 0 },
          { label: 'Total Orders', value: dashboardStats.totalOrders || 0 },
          { label: 'Total Revenue', value: `₹${(dashboardStats.totalRevenue || 0).toLocaleString('en-IN')}` },
          { label: 'Transactions', value: dashboardStats.totalTransactions || 0 },
          { label: 'Provider Balance', value: `₹${parseFloat(providerBalance?.balance || '0').toLocaleString('en-IN')}` },
          { label: 'Referral Payouts', value: `₹${dashboardStats.referralPayouts || 0}` },
          { label: 'Pending Recharges', value: dashboardStats.pendingRecharges || 0 },
        ].map((stat, i) => {
          const isProviderBalance = stat.label === 'Provider Balance';
          return (
            <div 
              key={i} 
              className={`p-5 rounded-2xl border transition-all relative group ${isProviderBalance && providerError ? 'border-red-500/20 bg-red-500/[0.02]' : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]'}`}
            >
              <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2 tracking-widest flex items-center justify-between">
                <span>{stat.label}</span>
                {isProviderBalance && providerError && (
                  <span className="text-[9px] text-red-500 font-bold uppercase tracking-normal animate-pulse">Offline</span>
                )}
              </div>
              <div className="text-2xl font-mono text-white font-bold">
                {isProviderBalance && providerError ? (
                  <span className="text-neutral-500">₹0</span>
                ) : (
                  stat.value
                )}
              </div>
              {isProviderBalance && providerError && (
                <div className="text-[9px] font-mono text-red-400 mt-2 break-all line-clamp-2" title={providerError}>
                  {providerError}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderUsers = () => {
    const filtered = users.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()) || (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search user emails or names..." 
              className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/10 rounded-xl text-white text-xs font-mono focus:border-white focus:outline-none" 
            />
          </div>
        </div>
        
        <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-black/40 text-neutral-500 uppercase tracking-wider text-[9px]">
                <th className="p-4">User</th>
                <th className="p-4 text-right">Balance</th>
                <th className="p-4 text-center">Status / Role</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(u => (
                <tr key={u.email} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">{u.email}</div>
                    <div className="text-[10px] text-neutral-500">{u.name}</div>
                  </td>
                  <td className="p-4 text-right text-emerald-400 font-bold">
                    ₹{u.balance}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-[9px] uppercase font-bold mr-2 ${u.status === 'banned' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {u.status || 'Active'}
                    </span>
                    {u.is_admin && <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-[9px] uppercase font-bold border border-red-500/30">Admin</span>}
                  </td>
                  <td className="p-4 text-right flex gap-2 justify-end">
                    <button 
                      onClick={() => {
                        const newBal = prompt('Enter new balance:', u.balance.toString());
                        if (newBal && !isNaN(parseFloat(newBal))) {
                          fetch(`${API_BASE}/api/smm/admin/users/update-balance`, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ email: u.email, balance: parseFloat(newBal) })
                          }).then(() => fetchUsers());
                        }
                      }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded flex items-center gap-1.5 border border-white/10"
                    >
                      <Edit className="w-3 h-3" /> Adjust
                    </button>
                    <button 
                      onClick={() => {
                        fetch(`${API_BASE}/api/smm/admin/users/toggle-ban`, {
                          method: 'POST', headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({ email: u.email, is_banned: u.status !== 'banned' })
                        }).then(() => fetchUsers());
                      }}
                      className={`px-3 py-1.5 rounded flex items-center gap-1.5 border ${u.status === 'banned' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                    >
                      {u.status === 'banned' ? <PlayCircle className="w-3 h-3" /> : <StopCircle className="w-3 h-3" />}
                      {u.status === 'banned' ? 'Reactivate' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTransactions = () => (
    <div className="space-y-6">
      <div className="border border-white/5 rounded-2xl bg-white/[0.01] p-6 text-center text-neutral-500 font-mono text-xs">
        <DollarSign className="w-8 h-8 opacity-20 mx-auto mb-3" />
        Transaction & Recharge logic will populate here based on real activity logs. No pending manual recharges found right now.
      </div>
    </div>
  );

  const renderMargin = () => {
    const handleSaveGlobal = () => {
      fetch(`${API_BASE}/api/smm/settings/update`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ 
          profit_markup_percent: globalMargin, 
          landing_video_url: landingVideo,
          smm_api_key: smmApiKey,
          smm_api_url: smmApiUrl
        })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          alert('System settings and SMM Provider credentials saved successfully!');
          onUpdateSettings(data.settings);
          fetchProviderBalance();
        } else {
          alert('Save failed: ' + (data.error || 'Unknown error'));
        }
      });
    };

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.01] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Global Margin Rule</h3>
            <p className="text-[10px] text-neutral-400 mt-1">Fallback markup % applied if no category or service specific margin is active.</p>
          </div>
          <div className="flex gap-4">
            <input 
              type="number" 
              value={globalMargin}
              onChange={e => setGlobalMargin(parseFloat(e.target.value) || 0)}
              className="flex-1 px-4 py-3 bg-black border border-white/10 rounded-xl text-white font-mono text-sm focus:border-white focus:outline-none"
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.01] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">SMM Provider Configuration</h3>
            <p className="text-[10px] text-neutral-400 mt-1">Enter SMM Provider API credentials to establish a dynamic, real-time sync with your secure Render provider API (e.g. socialuphub-backend.onrender.com).</p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">API Endpoint URL</label>
              <input 
                type="text" 
                value={smmApiUrl}
                onChange={e => setSmmApiUrl(e.target.value)}
                placeholder="https://socialuphub-backend.onrender.com/api/v2"
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white font-mono text-sm focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">API Key</label>
              <input 
                type="text" 
                value={smmApiKey}
                onChange={e => setSmmApiKey(e.target.value)}
                placeholder="Enter SMM API Key"
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white font-mono text-sm focus:border-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.01] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Landing Page Video URL</h3>
            <p className="text-[10px] text-neutral-400 mt-1">YouTube Embed URL shown on the main page before login.</p>
          </div>
          <div className="flex gap-4">
            <input 
              type="text" 
              value={landingVideo}
              onChange={e => setLandingVideo(e.target.value)}
              className="flex-1 px-4 py-3 bg-black border border-white/10 rounded-xl text-white font-mono text-sm focus:border-white focus:outline-none"
            />
          </div>
          <button onClick={handleSaveGlobal} className="w-full mt-4 py-3 rounded-xl bg-white text-black font-bold text-xs uppercase font-mono cursor-pointer hover:bg-neutral-200 transition-colors">
            Save System Settings
          </button>
        </div>
        
        <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-200">
          <h4 className="font-bold text-sm mb-2 text-blue-400">Hierarchy Flow</h4>
          <pre className="text-[10px] leading-relaxed font-mono opacity-80">
            PRICE CALCULATION:
            1. Check if specific Service Margin is set -&gt; Use it.
            2. Else Check if Category Margin is set -&gt; Use it.
            3. Else Use Global Margin ({globalMargin}%).
            
            Cost to User = API Provider Rate + Applied Margin %
          </pre>
        </div>
      </div>
    );
  };

  const renderCategories = () => {
    const filteredCategories = adminCategories.filter(cat => {
      const q = catSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return cat.name.toLowerCase().includes(q) || (cat.custom_name || '').toLowerCase().includes(q);
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input 
              value={catSearchQuery}
              onChange={e => setCatSearchQuery(e.target.value)}
              placeholder="Search category names..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-white text-xs font-mono focus:border-white focus:outline-none" 
            />
          </div>
          <button
            onClick={openCategoryCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-mono font-bold uppercase transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>

        <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-black/40 text-neutral-500 uppercase tracking-wider text-[9px]">
                <th className="p-4">Original Name</th>
                <th className="p-4">Display Name</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Sort Order</th>
                <th className="p-4 text-right">Custom Margin</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">
                    No categories found. Sync SMM updates or create a manual one.
                  </td>
                </tr>
              )}
              {filteredCategories.map(catItem => {
                const catName = catItem.name;
                const isActive = catItem.is_active !== false;
                return (
                  <tr key={catName} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-neutral-400 font-medium truncate max-w-xs" title={catName}>
                      {catName}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {catItem.custom_name || <span className="text-neutral-500 italic">None</span>}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => {
                          fetch(`${API_BASE}/api/smm/admin/categories/update`, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ name: catName, is_active: !isActive })
                          }).then(() => {
                            fetchCategories();
                            if (refreshServices) refreshServices(false);
                          });
                        }}
                        title="Click to toggle status"
                        className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold cursor-pointer transition-all border ${
                          !isActive 
                            ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {!isActive ? 'Disabled' : 'Active'}
                      </button>
                    </td>
                    <td className="p-4 text-center text-white font-bold">
                      {catItem.sort_order ?? '0'}
                    </td>
                    <td className="p-4 text-right text-emerald-400 font-bold">
                      {catItem.custom_margin !== null && catItem.custom_margin !== undefined ? `+${catItem.custom_margin}%` : <span className="text-neutral-500 font-normal">Global</span>}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => openCategoryEdit(catItem)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-neutral-300 hover:text-white transition-all text-[10px] flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(catName)}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 text-red-400 hover:text-red-300 transition-all text-[10px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderServices = () => {
    const filteredServices = adminServices.filter(srv => {
      const q = srvSearchQuery.toLowerCase().trim();
      
      // Search query filter
      if (q) {
        const matchId = srv.service_id.toString() === q;
        const matchName = srv.api_name.toLowerCase().includes(q) || (srv.custom_name || '').toLowerCase().includes(q);
        const matchDesc = (srv.custom_description || '').toLowerCase().includes(q);
        const matchCat = srv.category_name.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchDesc && !matchCat) return false;
      }

      // Category filter
      if (srvFilterCategory && srv.category_name !== srvFilterCategory) {
        return false;
      }

      // Status filter
      if (srvFilterStatus === 'active' && srv.is_active === false) return false;
      if (srvFilterStatus === 'disabled' && srv.is_active !== false) return false;

      return true;
    });

    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Controls block */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search */}
          <div className="relative md:col-span-4">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input 
              value={srvSearchQuery}
              onChange={e => setSrvSearchQuery(e.target.value)}
              placeholder="Search by ID, name, description..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl text-white text-xs font-mono focus:border-white focus:outline-none" 
            />
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <select
              value={srvFilterCategory}
              onChange={e => setSrvFilterCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-black border border-white/10 rounded-xl text-neutral-300 text-xs font-mono focus:border-white focus:outline-none"
            >
              <option value="">All Categories</option>
              {adminCategories.map(cat => (
                <option key={cat.name} value={cat.name}>
                  {cat.custom_name || cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={srvFilterStatus}
              onChange={e => setSrvFilterStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-black border border-white/10 rounded-xl text-neutral-300 text-xs font-mono focus:border-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>

          {/* Actions */}
          <div className="md:col-span-3 flex justify-end">
            <button
              onClick={openServiceCreate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-mono font-bold uppercase transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              <Plus className="w-4 h-4" /> Create Service
            </button>
          </div>
        </div>

        {/* Services table */}
        <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-black/40 text-neutral-500 uppercase tracking-wider text-[9px]">
                <th className="p-4 w-16">ID</th>
                <th className="p-4">Service Details</th>
                <th className="p-4 text-right">Provider Cost (₹)</th>
                <th className="p-4 text-right">Margin Override</th>
                <th className="p-4 text-center">Min / Max</th>
                <th className="p-4 text-center">Refill</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-500">
                    No services found matching the criteria.
                  </td>
                </tr>
              )}
              {filteredServices.slice(0, 300).map(srv => {
                const isActive = srv.is_active !== false;
                return (
                  <tr key={srv.service_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-mono font-bold text-neutral-500">{srv.service_id}</td>
                    <td className="p-4 max-w-md">
                      <div className="font-bold text-white truncate" title={srv.custom_name || srv.api_name}>
                        {srv.custom_name || srv.api_name}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1" title={srv.custom_description}>
                        {srv.custom_description || <span className="text-neutral-600 italic">No description</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] bg-white/5 text-neutral-300 px-1.5 py-0.5 rounded border border-white/5">
                          {srv.category_name}
                        </span>
                        <span className="text-[9px] text-neutral-500">
                          Type: {srv.type || 'Default'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-white">
                      ₹{parseFloat(srv.provider_rate || '0').toFixed(3)}
                    </td>
                    <td className="p-4 text-right text-emerald-400 font-bold">
                      {srv.custom_margin !== null && srv.custom_margin !== undefined ? `+${srv.custom_margin}%` : <span className="text-neutral-500 font-normal">Inherited</span>}
                    </td>
                    <td className="p-4 text-center text-neutral-300">
                      {srv.min_order ?? 10} / {srv.max_order ?? 10000}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${srv.refill ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-neutral-500/10 text-neutral-500 border border-white/5'}`}>
                        {srv.refill ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => {
                          fetch(`${API_BASE}/api/smm/admin/services/update`, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ service_id: srv.service_id, is_active: !isActive })
                          }).then(() => {
                            fetchServices();
                            if (refreshServices) refreshServices(false);
                          });
                        }}
                        title="Click to toggle status"
                        className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold cursor-pointer border transition-all ${
                          !isActive 
                            ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {!isActive ? 'Disabled' : 'Active'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => openServiceEdit(srv)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-neutral-300 hover:text-white transition-all text-[10px] flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteService(srv.service_id)}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 text-red-400 hover:text-red-300 transition-all text-[10px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredServices.length > 300 && (
            <div className="p-4 bg-black/40 text-center text-[10px] text-neutral-500 font-mono border-t border-white/5">
              Showing first 300 out of {filteredServices.length} matching services. Use the search box or category filter to narrow down results.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Navigation />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
          <div className="relative z-10 max-w-6xl mx-auto">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'transactions' && renderTransactions()}
            {activeTab === 'margins' && renderMargin()}
            {activeTab === 'categories' && renderCategories()}
            {activeTab === 'services' && renderServices()}
          </div>
        </div>
      </div>

      {/* Category Edit/Create Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 p-5 bg-black/30">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-white">
                {editingCategory ? `Edit Category` : 'Create New Category'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-neutral-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              {/* Original Name */}
              <div>
                <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                  Original Name (Primary Key - Matches SMM API Category)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingCategory}
                  value={catFormName}
                  onChange={e => setCatFormName(e.target.value)}
                  placeholder="e.g. Instagram Followers"
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                  Display Name (Override Name)
                </label>
                <input
                  type="text"
                  value={catFormCustomName}
                  onChange={e => setCatFormCustomName(e.target.value)}
                  placeholder="e.g. Premium Instagram Followers"
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                />
              </div>

              {/* Custom Margin */}
              <div>
                <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                  Category Markup % (leaves blank to inherit Global % markup)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={catFormCustomMargin}
                  onChange={e => setCatFormCustomMargin(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                  Sort Order (Ascending order. Note: 0 acts as bottom separator)
                </label>
                <input
                  type="number"
                  required
                  value={catFormSortOrder}
                  onChange={e => setCatFormSortOrder(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                <div>
                  <span className="block text-xs font-bold text-white uppercase font-mono">Category Status</span>
                  <span className="block text-[10px] text-neutral-400">If disabled, this category and its services are hidden</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCatFormIsActive(!catFormIsActive)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase border transition-all ${
                    catFormIsActive 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}
                >
                  {catFormIsActive ? 'Active' : 'Disabled'}
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 py-2.5 border border-white/10 text-neutral-400 hover:text-white rounded-xl text-xs uppercase font-mono transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs uppercase font-mono font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Edit/Create Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 p-5 bg-black/30">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-white">
                {editingService ? `Edit Service ID: ${srvFormId}` : 'Create New Service'}
              </h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-neutral-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveService} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Service ID */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Service ID (Must be unique ID)
                  </label>
                  <input
                    type="number"
                    required
                    disabled={!!editingService}
                    value={srvFormId}
                    onChange={e => setSrvFormId(e.target.value)}
                    placeholder="e.g. 1045"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    SMM Category
                  </label>
                  <select
                    required
                    value={srvFormCategoryName}
                    onChange={e => setSrvFormCategoryName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {adminCategories.map(cat => (
                      <option key={cat.name} value={cat.name}>
                        {cat.custom_name || cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original API Name */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Original Name (Provider Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={srvFormApiName}
                    onChange={e => setSrvFormApiName(e.target.value)}
                    placeholder="e.g. Instagram Followers [Max 10k]"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  />
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Display Name Override
                  </label>
                  <input
                    type="text"
                    value={srvFormCustomName}
                    onChange={e => setSrvFormCustomName(e.target.value)}
                    placeholder="e.g. Premium Real Followers"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Custom Description */}
              <div>
                <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                  Custom Description
                </label>
                <textarea
                  value={srvFormCustomDescription}
                  onChange={e => setSrvFormCustomDescription(e.target.value)}
                  placeholder="Provide speed guidelines, start times, or quality notes..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider Rate */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Provider Rate per 1000 (₹)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={srvFormProviderRate}
                    onChange={e => setSrvFormProviderRate(e.target.value)}
                    placeholder="e.g. 15.5"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  />
                </div>

                {/* Custom Margin */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Custom Margin % Override (leaves blank to inherit Category/Global Margin)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={srvFormCustomMargin}
                    onChange={e => setSrvFormCustomMargin(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Min Order */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={srvFormMinOrder}
                    onChange={e => setSrvFormMinOrder(e.target.value)}
                    placeholder="10"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  />
                </div>

                {/* Max Order */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Max Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={srvFormMaxOrder}
                    onChange={e => setSrvFormMaxOrder(e.target.value)}
                    placeholder="10000"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-neutral-400 mb-1">
                    Service Type
                  </label>
                  <input
                    type="text"
                    required
                    value={srvFormType}
                    onChange={e => setSrvFormType(e.target.value)}
                    placeholder="e.g. Default"
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-white font-mono text-xs focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Refill */}
                <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                  <div>
                    <span className="block text-xs font-bold text-white uppercase font-mono">Refill Guarantee</span>
                    <span className="block text-[10px] text-neutral-400">Enable client manual refill buttons</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSrvFormRefill(!srvFormRefill)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase border transition-all ${
                      srvFormRefill 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                        : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
                    }`}
                  >
                    {srvFormRefill ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Service Status */}
                <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                  <div>
                    <span className="block text-xs font-bold text-white uppercase font-mono">Active Status</span>
                    <span className="block text-[10px] text-neutral-400">Enable this service in catalog for ordering</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSrvFormIsActive(!srvFormIsActive)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase border transition-all ${
                      srvFormIsActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}
                  >
                    {srvFormIsActive ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="flex-1 py-2.5 border border-white/10 text-neutral-400 hover:text-white rounded-xl text-xs uppercase font-mono transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs uppercase font-mono font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
