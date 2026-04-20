import { createContext, useContext, useState } from 'react'

const LocaleContext = createContext({ locale: 'en', toggle: () => {} })

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState(
    () => localStorage.getItem('aurasync-locale') ?? 'en',
  )

  const toggle = () =>
    setLocale((l) => {
      const next = l === 'en' ? 'zh' : 'en'
      localStorage.setItem('aurasync-locale', next)
      return next
    })

  return (
    <LocaleContext.Provider value={{ locale, toggle }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => useContext(LocaleContext)
