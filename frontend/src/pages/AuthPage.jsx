import React from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { LoginForm } from '@/components/login-form';
import { useAuth } from '@/context/AuthContext';

/**
 * AuthPage — dedicated route for /login and /signup.
 * Renders the existing LoginForm component in a centered layout.
 * Redirects to /app if already authenticated.
 */
export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const isSignup = location.pathname === '/signup';

  // If already authenticated, redirect to app
  if (!loading && user) {
    return <Navigate to="/app" replace />;
  }

  // Show loading state during session restoration
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Rocket className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">JobFinder</span>
          </Link>
          <div className="flex items-center gap-3">
            {isSignup ? (
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
              >
                Login
              </Link>
            ) : (
              <Link
                to="/signup"
                className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                Sign up
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Auth form centered */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <LoginForm
            initialMode={isSignup ? 'signup' : 'login'}
            onClose={() => {
              // After successful OAuth, AuthContext sets user → re-render triggers Navigate
              // Use navigate as backup for immediate redirect
              navigate('/app', { replace: true });
            }}
          />
        </div>
      </div>
    </div>
  );
}
