"use client";

import React, { createContext, useContext, useState } from "react";
import { translations, Language, TranslationKey } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "shopm_language";

type TranslationDict = Record<TranslationKey, string>;

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "hi") return saved;
    } catch {
      // Ignore localStorage errors
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore localStorage errors
    }
  };

  const toggleLanguage = () => {
    const next = language === "en" ? "hi" : "en";
    setLanguage(next);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const langDict = (translations[language] || translations.en) as TranslationDict;
    let template = langDict[key] || (translations.en as TranslationDict)[key] || key;

    if (params) {
      for (const [paramKey, val] of Object.entries(params)) {
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(val));
      }
    }

    return template;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
