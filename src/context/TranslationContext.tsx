import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { translateText, translateBatch } from '../utils/translateUtils';

interface TranslationContextType {
  translations: Record<string, string>;
  translateSingular: (text: string) => Promise<string>;
  translateMultiple: (texts: string[]) => Promise<void>;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [targetLanguage, setTargetLanguage] = useState<string>('id');

  const translateSingular = useCallback(async (text: string) => {
    if (!text || text.trim() === '') return text;
    if (translations[text]) return translations[text];

    const result = await translateText(text, targetLanguage);
    setTranslations((prev) => ({ ...prev, [text]: result }));
    return result;
  }, [translations, targetLanguage]);

  const translateMultiple = useCallback(async (texts: string[]) => {
    const toTranslate = texts.filter((t) => t && t.trim() !== '' && !translations[t]);
    if (toTranslate.length === 0) return;

    // We process batch array by chunk chunks of 50 to avoid URL length limit
    for (let i = 0; i < toTranslate.length; i += 50) {
      const chunk = toTranslate.slice(i, i + 50);
      const results = await translateBatch(chunk, targetLanguage);
      
      setTranslations((prev) => {
        const newTrans = { ...prev };
        chunk.forEach((text, index) => {
          if (results[index]) {
            newTrans[text] = results[index];
          }
        });
        return newTrans;
      });
    }
  }, [translations, targetLanguage]);

  return (
    <TranslationContext.Provider
      value={{
        translations,
        translateSingular,
        translateMultiple,
        targetLanguage,
        setTargetLanguage,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
