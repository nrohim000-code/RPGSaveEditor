import React, { useState } from 'react';
import { useTranslation } from '../context/TranslationContext';

interface Props {
  text: string;
}

const TranslateText: React.FC<Props> = ({ text }) => {
  const { translations, translateSingular } = useTranslation();
  const [translating, setTranslating] = useState(false);

  if (!text) return <></>;

  const translated = translations[text];

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (translating) return;
    setTranslating(true);
    await translateSingular(text);
    setTranslating(false);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ marginRight: '8px' }}>{translated || text}</span>
      {!translated && (
        <span 
          style={{ cursor: 'pointer', fontSize: '14px', opacity: translating ? 0.5 : 1 }} 
          onClick={handleTranslate}
          title="Translate"
        >
          {translating ? '⏳' : '🌐'}
        </span>
      )}
    </span>
  );
};

export default TranslateText;
