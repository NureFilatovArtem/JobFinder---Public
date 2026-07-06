import React, { createContext, useState, useContext } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'personalization'

    const openSettings = (tab = 'general') => {
        setActiveTab(tab);
        setIsSettingsOpen(true);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
    };

    return (
        <SettingsContext.Provider value={{ isSettingsOpen, openSettings, closeSettings, activeTab, setActiveTab }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
