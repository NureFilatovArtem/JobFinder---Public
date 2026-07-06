import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Public pages
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import ContactPage from './pages/ContactPage';

// Protected pages
import DashboardLayout from './components/layout/DashboardLayout';
import Vacatures from './pages/Vacatures';
import DemandMap from './pages/DemandMap';
import Cards from './pages/Cards';
import Profile from './pages/Profile';
import SelectedVacatures from './pages/SelectedVacatures';
import Pricing from './pages/Pricing';
import AutoApply from './pages/AutoApply';
import Extension from './pages/Extension';
import Billing from './pages/Billing';
import BlockedOrganizations from './pages/BlockedOrganizations';
import CVBuilder from './pages/CVBuilder';
import ApplicationsHub from './pages/ApplicationsHub';
import FAQ from './pages/FAQ';

// Context & providers
import { CountryProvider } from './context/CountryContext';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import SettingsModal from './components/SettingsModal';
import { Toaster } from '@/components/ui/sonner';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.error('❌ VITE_GOOGLE_CLIENT_ID is not set. Google OAuth will not work.');
}

/**
 * Route guard: requires authentication.
 * Redirects to "/" (landing) if not authenticated.
 * Shows spinner during session restoration.
 */
function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/**
 * Redirect authenticated users from public auth routes to /app.
 */
function PublicOnly() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}

/**
 * Auto Apply route guard: requires autoApplyAccess from backend.
 */
function ProtectedAutoApply() {
  const { autoApplyAccess, loading } = useAuth();
  if (loading) return null;
  if (!autoApplyAccess.hasAccess) return <Navigate to="/app" replace />;
  return <AutoApply />;
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <SettingsProvider>
          <CountryProvider>
            <Router>
              <Routes>
                {/* ========== PUBLIC ROUTES ========== */}
                <Route element={<PublicOnly />}>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<AuthPage />} />
                  <Route path="/signup" element={<AuthPage />} />
                </Route>

                {/* ========== PROTECTED ROUTES (/app/*) ========== */}
                <Route element={<RequireAuth />}>
                  <Route path="/app" element={
                    <>
                      <SettingsModal />
                      <DashboardLayout>
                        <Outlet />
                      </DashboardLayout>
                      <Toaster richColors position="top-center" />
                    </>
                  }>
                    <Route index element={<Vacatures />} />
                    <Route path="map" element={<DemandMap />} />
                    <Route path="cards" element={<Cards />} />
                    <Route path="selected" element={<SelectedVacatures />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="pricing" element={<Pricing />} />
                    <Route path="auto-apply" element={<ProtectedAutoApply />} />
                    <Route path="extension" element={<Extension />} />
                    <Route path="billing" element={<Billing />} />
                    <Route path="blocked-organizations" element={<BlockedOrganizations />} />
                    <Route path="cv-builder" element={<CVBuilder />} />
                    <Route path="applications" element={<ApplicationsHub />} />
                    <Route path="faq" element={<FAQ />} />
                  </Route>
                </Route>

                {/* Public standalone pages (no auth guard) */}
                <Route path="/contact" element={<ContactPage />} />

                {/* Catch-all: redirect to landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </CountryProvider>
        </SettingsProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
