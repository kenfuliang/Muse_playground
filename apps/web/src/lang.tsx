import React, { createContext, useContext, useState } from 'react';
import { t as dict, type Lang } from '@brainfactory/shared';
import { getSessionUser } from './api.js';

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'zh', setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const u = getSessionUser();
    return u?.lang === 'vi' ? 'vi' : 'zh';
  });
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(LangCtx);
  return { lang, setLang, t: dict(lang) };
}
