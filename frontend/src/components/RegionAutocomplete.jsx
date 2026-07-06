import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getAllRegions, getCitiesForProvince } from '../data/belgianRegions';
import './RegionAutocomplete.css';

const allRegions = getAllRegions();

const RegionAutocomplete = ({ selectedRegions, onRegionsChange }) => {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Filter suggestions based on input
    const suggestions = React.useMemo(() => {
        const query = inputValue.toLowerCase().trim();

        // When focused but no query, show popular regions
        const filtered = query.length === 0
            ? allRegions.filter(r => r.type === 'province' || ['Brussel', 'Antwerpen', 'Gent', 'Brugge', 'Leuven', 'Hasselt', 'Charleroi', 'Luik'].includes(r.name))
            : allRegions.filter(r => {
                const nameMatch = r.name.toLowerCase().includes(query);
                const frenchMatch = r.frenchName && r.frenchName.toLowerCase().includes(query);
                const provinceMatch = r.province && r.province.toLowerCase().includes(query);
                return nameMatch || frenchMatch || provinceMatch;
            });

        // Remove already selected
        const notSelected = filtered.filter(r =>
            !selectedRegions.includes(r.name)
        );

        // Sort: provinces first, then by name
        notSelected.sort((a, b) => {
            if (a.type === 'province' && b.type !== 'province') return -1;
            if (a.type !== 'province' && b.type === 'province') return 1;
            return a.name.localeCompare(b.name);
        });

        return notSelected.slice(0, 10);
    }, [inputValue, selectedRegions]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex >= 0 && listRef.current) {
            const items = listRef.current.children;
            if (items[highlightIndex]) {
                items[highlightIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightIndex]);

    const handleSelect = useCallback((region) => {
        if (region.type === 'province') {
            // Add all cities in this province
            const provinceCities = getCitiesForProvince(region.name);
            const newRegions = [...new Set([...selectedRegions, ...provinceCities])];
            onRegionsChange(newRegions);
        } else {
            if (!selectedRegions.includes(region.name)) {
                onRegionsChange([...selectedRegions, region.name]);
            }
        }
        setInputValue('');
        setHighlightIndex(-1);
        inputRef.current?.focus();
    }, [selectedRegions, onRegionsChange]);

    const handleRemove = useCallback((regionName) => {
        onRegionsChange(selectedRegions.filter(r => r !== regionName));
    }, [selectedRegions, onRegionsChange]);

    const handleClearAll = useCallback(() => {
        onRegionsChange([]);
        setInputValue('');
    }, [onRegionsChange]);

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightIndex >= 0 && suggestions[highlightIndex]) {
                    handleSelect(suggestions[highlightIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightIndex(-1);
                break;
            case 'Backspace':
                if (inputValue === '' && selectedRegions.length > 0) {
                    handleRemove(selectedRegions[selectedRegions.length - 1]);
                }
                break;
            default:
                break;
        }
    };

    return (
        <div ref={containerRef} className="region-autocomplete">
            {/* Input area */}
            <div
                className={`region-autocomplete__input-wrapper ${isOpen ? 'region-autocomplete__input-wrapper--focused' : ''}`}
                onClick={() => inputRef.current?.focus()}
            >
                <svg className="region-autocomplete__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>

                <div className="region-autocomplete__input-area">
                    {/* Selected chips inline */}
                    {selectedRegions.map(region => (
                        <span key={region} className="region-autocomplete__chip">
                            {region}
                            <button
                                type="button"
                                className="region-autocomplete__chip-remove"
                                onClick={(e) => { e.stopPropagation(); handleRemove(region); }}
                                aria-label={`Remove ${region}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}

                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            setHighlightIndex(-1);
                            if (!isOpen) setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedRegions.length === 0 ? 'Zoek stad of provincie...' : ''}
                        className="region-autocomplete__input"
                        autoComplete="off"
                    />
                </div>

                {/* Clear button */}
                {(selectedRegions.length > 0 || inputValue) && (
                    <button
                        type="button"
                        className="region-autocomplete__clear"
                        onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
                        aria-label="Clear all"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Dropdown - only when focused */}
            {isOpen && suggestions.length > 0 && (
                <ul ref={listRef} className="region-autocomplete__dropdown" role="listbox">
                    {suggestions.map((region, index) => (
                        <li
                            key={`${region.type}-${region.name}`}
                            role="option"
                            aria-selected={index === highlightIndex}
                            className={`region-autocomplete__option ${index === highlightIndex ? 'region-autocomplete__option--highlighted' : ''}`}
                            onMouseEnter={() => setHighlightIndex(index)}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                handleSelect(region);
                            }}
                        >
                            <svg className="region-autocomplete__option-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>

                            <div className="region-autocomplete__option-text">
                                <span className="region-autocomplete__option-name">{region.name}</span>
                                {region.frenchName && (
                                    <span className="region-autocomplete__option-french"> ({region.frenchName})</span>
                                )}
                                {region.type === 'city' && (
                                    <span className="region-autocomplete__option-province"> — {region.province}</span>
                                )}
                            </div>

                            {region.type === 'province' && (
                                <span className="region-autocomplete__badge">Provincie</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {isOpen && suggestions.length === 0 && inputValue.trim().length > 0 && (
                <div className="region-autocomplete__dropdown region-autocomplete__no-results">
                    Geen resultaten voor "{inputValue}"
                </div>
            )}
        </div>
    );
};

export default RegionAutocomplete;
