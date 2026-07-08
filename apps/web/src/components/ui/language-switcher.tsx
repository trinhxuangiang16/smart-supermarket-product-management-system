import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
] as const;

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("vi") ? "vi" : "en";

  return (
    <div className="inline-flex h-10 items-center rounded-full border border-[#ead6aa] bg-[#fffaf0] p-1 text-xs font-semibold">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          className={`rounded-full px-2.5 py-1.5 transition ${
            current === code ? "bg-[var(--color-sidebar-active)] text-white shadow-sm" : "text-[#6d5935] hover:bg-[#f4f6e9]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
