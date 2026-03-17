import React, { createContext, useContext, useState } from 'react';

export const CURRENCY_SYMBOLS = { ILS: '₪', USD: '$', EUR: '€' };

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currencyCode, setCurrencyCodeState] = useState(() =>
    localStorage.getItem('app_currency') || 'ILS'
  );

  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || '₪';

  const setCurrencyCode = (code) => {
    localStorage.setItem('app_currency', code);
    setCurrencyCodeState(code);
  };

  const fmt = (n) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(n);

  return (
    <CurrencyContext.Provider value={{ currencyCode, currencySymbol, setCurrencyCode, fmt }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
