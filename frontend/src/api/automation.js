// Frontend API for Automation Hub
// Provides React hooks and functions for automation status and controls

import client from './client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Subscription plan constants (matching backend)
export const SUBSCRIPTION_PLANS = {
    FREE: { id: 1, name: 'free', displayName: 'Free', price: 0, autoApplyLimit: 0 },
    STARTER: { id: 2, name: 'starter', displayName: 'Starter', price: 15, autoApplyLimit: 0 },
    PRO: { id: 3, name: 'pro', displayName: 'Pro', price: 20, autoApplyLimit: -1 },
    FAST: { id: 4, name: 'fast', displayName: 'Fast', price: 100, autoApplyLimit: 500 }
};

// Get automation status for a user (uses authenticated client)
export async function getAutomationStatus() {
    try {
        // Use the authenticated client - userId is derived from JWT on backend
        const response = await client.get('/automation/status');
        return response.data;
    } catch (error) {
        console.error('Error fetching automation status:', error);
        return null;
    }
}

// Get available subscription plans
export async function getSubscriptionPlans() {
    try {
        const response = await client.get('/automation/plans');
        return response.data;
    } catch (error) {
        console.error('Error fetching plans:', error);
        return { plans: [] };
    }
}

// Add jobs to auto-apply queue (uses authenticated client)
export async function addToQueue(userId, vacancyIds) {
    try {
        const response = await client.post('/automation/queue/add', { vacancyIds });
        return response.data;
    } catch (error) {
        console.error('Error adding to queue:', error);
        throw error;
    }
}

// Format auto-apply limit for display
export function formatAutoApplyLimit(limit, used = 0) {
    if (limit === 0) {
        return 'Not Available';
    }
    if (limit === -1) {
        return 'Unlimited';
    }
    return `${used}/${limit}`;
}

// Check if user has auto-apply access
export function hasAutoApplyAccess(planName) {
    return planName === 'pro' || planName === 'fast';
}

// Get plan upgrade message
export function getUpgradeMessage(currentPlan) {
    if (currentPlan === 'free' || currentPlan === 'starter') {
        return 'Upgrade to Pro or Fast plan to use Auto-Apply';
    }
    return null;
}

