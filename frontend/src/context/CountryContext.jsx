import React, { createContext, useState, useContext } from 'react';

const CountryContext = createContext();

export const countries = [
    {
        code: 'BE', name: 'Belgium', center: [50.8503, 4.3517], zoom: 8, cities: [
            'Antwerpen', 'Brussel', 'Gent', 'Charleroi', 'Luik', 'Brugge', 'Namen', 'Leuven',
            'Bergen', 'Aalst', 'Mechelen', 'Hasselt', 'Sint-Niklaas', 'Kortrijk', 'Oostende',
            'Doornik', 'Genk', 'Roeselare', 'Turnhout', 'Dendermonde', 'Vilvoorde', 'Halle',
            'Tienen', 'Ieper', 'Lommel', 'Tongeren', 'Aarschot', 'Diest', 'Waregem', 'Menen'
        ]
    },
    { code: 'NL', name: 'Netherlands', center: [52.1326, 5.2913], zoom: 7, cities: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven'] },
    { code: 'DE', name: 'Germany', center: [51.1657, 10.4515], zoom: 6, cities: ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt'] }
];

export const CountryProvider = ({ children }) => {
    const [selectedCountry, setSelectedCountry] = useState(countries[0]); // Default Belgium

    return (
        <CountryContext.Provider value={{ selectedCountry, setSelectedCountry, countries }}>
            {children}
        </CountryContext.Provider>
    );
};

export const useCountry = () => useContext(CountryContext);
