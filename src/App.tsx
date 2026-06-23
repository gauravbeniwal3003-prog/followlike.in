import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { UserSession, SMMService } from './types';
import { INITIAL_SERVICES, INITIAL_ORDERS, INITIAL_TICKETS } from './data';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [services, setServices] = useState<SMMService[]>(INITIAL_SERVICES);
  const [globalSettings, setGlobalSettings] = useState({
    landing_video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&mute=1&controls=1',
    profit_markup_percent: 15
  });

  // Fetch dynamic settings from server
  const fetchSettings = () => {
    fetch('/api/smm/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.settings) {
          setGlobalSettings(data.settings);
        }
      })
      .catch(err => {
        console.warn('Backend settings connection delayed, relying on fallback.', err);
      });
  };

  // Fetch live SMM services from our backend API proxy on boot
  useEffect(() => {
    fetch('/api/smm/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.services) && data.services.length > 0) {
          console.log(`Live SMM Catalogue linked! Loaded ${data.services.length} services directly.`);
          setServices(data.services);
        }
      })
      .catch(err => {
        console.warn('Backend service connection unavailable, relying on default offline catalog caching.', err);
      });
    
    fetchSettings();
  }, [globalSettings.profit_markup_percent]);

  // Read stored user session on initial boot up
  useEffect(() => {
    try {
      const stored = localStorage.getItem('smm_session');
      if (stored) {
        setSession(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Session loading failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    localStorage.setItem('smm_session', JSON.stringify(userSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('smm_session');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center font-bold text-black text-lg animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.4)]">
            S
          </div>
        </div>
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest animate-pulse">
          Loading your panel...
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/admin" 
          element={
            <AdminPanel 
              session={session} 
              globalSettings={globalSettings} 
              onUpdateSettings={(newSet: any) => setGlobalSettings(newSet)} 
            />
          } 
        />
        <Route 
          path="/" 
          element={
            session ? (
              <Dashboard
                session={session}
                onLogout={handleLogout}
                servicesCatalog={services}
                initialOrders={INITIAL_ORDERS}
                initialTickets={INITIAL_TICKETS}
                globalSettings={globalSettings}
                onUpdateSettings={(newSet) => setGlobalSettings(newSet)}
              />
            ) : (
              <LandingPage
                servicesCatalog={services}
                userEmail="gauravbeniwal30003@gmail.com"
                onLoginAttempt={() => {}}
                onLoginSuccess={handleLoginSuccess}
                landingVideoUrl={globalSettings.landing_video_url}
              />
            )
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

