"use client";

import { useEffect } from "react";

export default function DocumentLanguage({ language }) {
  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previousLanguage || "en";
    };
  }, [language]);

  return null;
}
