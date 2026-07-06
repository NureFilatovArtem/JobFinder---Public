import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { autoApplyAccessAPI } from '../api/featureFlags';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Auto Apply access state — driven by backend, never computed locally
    const [autoApplyAccess, setAutoApplyAccess] = useState({
        hasAccess: false,
        featureEnabled: false,
        isPrivileged: false
    });

    useEffect(() => {
        restoreSession();
    }, []);

    /**
     * Restore session on page reload.
     * Calls GET /api/auth/me — the httpOnly cookie is sent automatically.
     * If the cookie is missing or invalid, the server returns 401.
     */
    const restoreSession = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/me`, {
                credentials: 'include'
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
                await fetchAutoApplyAccess();
            } else {
                // No valid cookie — user is not authenticated
                setUser(null);
            }
        } catch (error) {
            console.error('Session restore failed:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchAutoApplyAccess = async () => {
        try {
            const data = await autoApplyAccessAPI.check();
            setAutoApplyAccess(data);
        } catch {
            setAutoApplyAccess({ hasAccess: false, featureEnabled: false, isPrivileged: false });
        }
    };

    const loginWithEmail = async (email, password) => {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login failed');
        setUser(data.user);
        await fetchAutoApplyAccess();
        return data.user;
    };

    const registerWithEmail = async (email, password, name) => {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Registration failed');
        setUser(data.user);
        await fetchAutoApplyAccess();
        return data.user;
    };

    const loginWithGoogle = async (googleToken) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: googleToken })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Google login failed');
            }

            const data = await response.json();
            // Token is set as httpOnly cookie by the server — no localStorage needed
            setUser(data.user);
            await fetchAutoApplyAccess();
            return data.user;
        } catch (error) {
            console.error('Google Login Error:', error);
            throw error;
        }
    };

    const loginWithApple = async (appleToken, appleUser) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/apple`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: appleToken, user: appleUser })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Apple login failed');
            }

            const data = await response.json();
            // Token is set as httpOnly cookie by the server — no localStorage needed
            setUser(data.user);
            await fetchAutoApplyAccess();
            return data.user;
        } catch (error) {
            console.error('Apple Login Error:', error);
            throw error;
        }
    };

    /**
     * Logout: call backend to clear the httpOnly cookie, then reset state.
     * Route guard will redirect to "/" automatically when user becomes null.
     */
    const logout = useCallback(async () => {
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        setUser(null);
        setAutoApplyAccess({ hasAccess: false, featureEnabled: false, isPrivileged: false });
    }, []);

    return (
        <AuthContext.Provider value={{
            user, loginWithEmail, registerWithEmail, loginWithGoogle, loginWithApple, logout, loading,
            autoApplyAccess,
            refreshAutoApplyAccess: fetchAutoApplyAccess
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
