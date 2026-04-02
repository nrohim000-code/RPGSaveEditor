export const translateText = async (text: string, targetLang: string = 'id'): Promise<string> => {
  if (!text || !text.trim()) return text;
  
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data[0].map((item: any) => item[0]).join('');
  } catch (error) {
    console.error("Translation error:", error);
    return text; // Return original on error
  }
};

export const translateBatch = async (texts: string[], targetLang: string = 'id'): Promise<string[]> => {
  if (!texts || texts.length === 0) return [];
  
  const joinedText = texts.join('\n');
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(joinedText)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const translatedText = data[0].map((item: any) => item[0]).join('');
    // Google Translate sometimes adds extra spaces around newlines or eats them, but mostly split by newline works.
    return translatedText.split('\n').map((s: string) => s.trim());
  } catch (error) {
    console.error("Batch translation error:", error);
    return texts; // Return original on error
  }
};
