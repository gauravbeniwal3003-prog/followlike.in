const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
import React, { useState, useEffect } from 'react';
import { UserSession, SMMService } from '../types';
import { 
  Users, BarChart3, Settings, ShieldCheck, DollarSign, LayoutList, Layers, 
  Search, Edit, StopCircle, PlayCircle, RefreshCw, X, Check, Save
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
  // Category / Service Data
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, any>>({});
  const [serviceOverrides, setServiceOverrides] = useState<Record<string, any>>({});
  const [adminServices, setAdminServices] = useState<any[]>([]);
  const [adminCategories, setAdminCategories] = useState<any[]>([]);
  const [providerBalance, setProviderBalance] = useState<{ balance: string; currency: string } | null>(null);
  const [allServices, setAllServices] = useState<SMMService[]>([]);

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
  const fetchProviderBalance = () => fetch(`${API_BASE}/api/smm/admin/provider-balance`).then(r => r.json()).then(d => { if(d.success) setProviderBalance({ balance: d.balance, currency: d.currency }) });
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
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors relative group">
            <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2 tracking-widest">{stat.label}</div>
            <div className="text-2xl font-mono text-white font-bold">{stat.value}</div>
          </div>
        ))}
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
          landing_video_url: landingVideo 
        })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          alert('System settings saved and prices synced!');
          onUpdateSettings({
            profit_markup_percent: globalMargin,
            landing_video_url: landingVideo
          });
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
          <button onClick={handleSaveGlobal} className="w-full mt-4 py-3 rounded-xl bg-white text-black font-bold text-xs uppercase font-mono">
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
    return (
      <div className="space-y-6">
        <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-black/40 text-neutral-500 uppercase tracking-wider text-[9px]">
                <th className="p-4">Category Name</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Sort Order</th>
                <th className="p-4 text-right">Custom Margin %</th>
                <th className="p-4 text-right">Configuration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {adminCategories.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-500">No categories found. Performance a sync if empty.</td>
                </tr>
              )}
              {adminCategories.map(catItem => {
                const cat = catItem.name;
                const isActive = catItem.is_active !== false;
                return (
                  <tr key={cat} className="hover:bg-white/[0.02]">
                    <td className="p-4 font-bold text-white">{catItem.custom_name || cat}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${!isActive ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {!isActive ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td className="p-4 text-center text-white">
                      {catItem.sort_order ?? 'N/A'}
                    </td>
                    <td className="p-4 text-right text-emerald-400">
                      {catItem.custom_margin !== null && catItem.custom_margin !== undefined ? `+${catItem.custom_margin}%` : 'Use Global'}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => {
                          const n = prompt('Display Name:', catItem.custom_name || cat);
                          const m = prompt('Custom Margin % (leave blank to clear):', catItem.custom_margin?.toString() || '');
                          const s = prompt('Sort Order:', catItem.sort_order?.toString() || '0');
                          const parsedS = s !== null ? parseInt(s) : null;
                          fetch(`${API_BASE}/api/smm/admin/categories/update`, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ 
                              name: cat, 
                              custom_name: n || null, 
                              custom_margin: m ? parseFloat(m) : null,
                              sort_order: parsedS !== null && !isNaN(parsedS) ? parsedS : null
                            })
                          }).then(() => fetchCategories());
                        }}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded mr-2 border border-white/10 text-neutral-400 hover:text-white transition-all text-[10px]"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => {
                          fetch(`${API_BASE}/api/smm/admin/categories/update`, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ name: cat, is_active: !isActive })
                          }).then(() => fetchCategories());
                        }}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-neutral-400 hover:text-white transition-all text-[10px]"
                      >
                        {isActive ? 'Disable' : 'Enable'}
                      </button>
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

  const renderServices = () => (
    <div className="space-y-6">
      <div className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-black/40 text-neutral-500 uppercase tracking-wider text-[9px]">
              <th className="p-4">ID</th>
              <th className="p-4">Service Details</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right">Margin Override</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {adminServices.length === 0 && (
               <tr>
                 <td colSpan={5} className="p-8 text-center text-neutral-500">No services found in database.</td>
               </tr>
            )}
            {adminServices.slice(0, 500).map(srv => {
              const isActive = srv.is_active !== false;
              return (
                <tr key={srv.service_id} className="hover:bg-white/[0.02]">
                  <td className="p-4 font-bold text-neutral-500">{srv.service_id}</td>
                  <td className="p-4">
                    <div className="font-bold text-white max-w-sm truncate">{srv.custom_name || srv.api_name}</div>
                    <div className="text-[10px] text-neutral-500 max-w-sm truncate">{srv.custom_description || srv.category_name}</div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${!isActive ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {!isActive ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-right text-emerald-400">
                    {srv.custom_margin !== null && srv.custom_margin !== undefined ? `+${srv.custom_margin}%` : 'Inherited'}
                  </td>
                  <td className="p-4 text-right flex gap-1 justify-end">
                    <button 
                      onClick={() => {
                        const n = prompt('Override Name:', srv.custom_name || srv.api_name);
                        const d = prompt('Override Description:', srv.custom_description || '');
                        const m = prompt('Custom Margin % (leave blank to inherit):', srv.custom_margin?.toString() || '');
                        fetch(`${API_BASE}/api/smm/admin/services/update`, {
                          method: 'POST', headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({ 
                            service_id: srv.service_id, 
                            custom_name: n || null, 
                            custom_description: d || null,
                            custom_margin: m ? parseFloat(m) : null 
                          })
                        }).then(() => fetchServices());
                      }}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-neutral-400 hover:text-white transition-all"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => {
                        fetch(`${API_BASE}/api/smm/admin/services/update`, {
                          method: 'POST', headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({ service_id: srv.service_id, is_active: !isActive })
                        }).then(() => fetchServices());
                      }}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-neutral-400 hover:text-white transition-all"
                    >
                      {isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {adminServices.length > 100 && <div className="p-4 text-center text-[10px] text-neutral-500 font-mono">Showing first 100 services. Search capability recommended.</div>}
      </div>
    </div>
  );

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
    </div>
  );
}
