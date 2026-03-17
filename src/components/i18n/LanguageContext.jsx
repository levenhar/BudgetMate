import React, { createContext, useContext, useState, useEffect } from 'react';
import { getTranslations } from './translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children, onLanguageChange }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('app_language') || 'he';
  });

  const t = getTranslations(lang);
  const dir = t.direction;

  // Apply dir to <html> element whenever language changes
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  const setLang = (newLang) => {
    localStorage.setItem('app_language', newLang);
    setLangState(newLang);
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}