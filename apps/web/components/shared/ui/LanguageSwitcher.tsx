"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  defaultLocale,
  isValidLocale,
  locales,
  type Locale,
} from "../../../i18n/config";

type LanguageSwitcherProps = {
  currentLocale: Locale;
};

type LanguageOption = {
  name: string;
  shortName: string;
  flag: string;
};

const languages: Record<Locale, LanguageOption> = {
  es: {
    name: "Español",
    shortName: "ES",
    flag: "🇪🇸",
  },
  en: {
    name: "English",
    shortName: "EN",
    flag: "🇺🇸",
  },
  "pt-BR": {
    name: "Português",
    shortName: "PT",
    flag: "🇧🇷",
  },
  fr: {
    name: "Français",
    shortName: "FR",
    flag: "🇫🇷",
  },
};

export function LanguageSwitcher({
  currentLocale,
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();

  const menuRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages[currentLocale];

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );

      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, []);

  function changeLanguage(selectedLocale: Locale) {
    const pathSegments = pathname.split("/");

    if (
      pathSegments.length > 1 &&
      isValidLocale(pathSegments[1] ?? "")
    ) {
      pathSegments[1] = selectedLocale;
    } else {
      pathSegments.splice(1, 0, selectedLocale);
    }

    const newPathname =
      pathSegments.join("/") || `/${defaultLocale}`;

    setIsOpen(false);
    router.push(newPathname);
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: "relative",
      }}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Seleccionar idioma"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
        style={{
          minHeight: "42px",
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "0 13px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "10px",
          background: "rgba(255, 255, 255, 0.05)",
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          transition:
            "background 160ms ease, border-color 160ms ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: "17px",
            lineHeight: 1,
          }}
        >
          {currentLanguage.flag}
        </span>

        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {currentLanguage.shortName}
        </span>

        <span
          aria-hidden="true"
          style={{
            fontSize: "11px",
            opacity: 0.65,
            transform: isOpen
              ? "rotate(180deg)"
              : "rotate(0deg)",
            transition: "transform 160ms ease",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Idiomas disponibles"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            width: "190px",
            padding: "7px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "12px",
            background: "#111827",
            boxShadow:
              "0 18px 45px rgba(0, 0, 0, 0.35)",
          }}
        >
          {locales.map((locale) => {
            const language = languages[locale];
            const isActive = locale === currentLocale;

            return (
              <button
                aria-selected={isActive}
                key={locale}
                onClick={() => changeLanguage(locale)}
                role="option"
                type="button"
                style={{
                  width: "100%",
                  minHeight: "42px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "0 11px",
                  border: "none",
                  borderRadius: "8px",
                  background: isActive
                    ? "rgba(99, 102, 241, 0.18)"
                    : "transparent",
                  color: "#ffffff",
                  cursor: "pointer",
                  font: "inherit",
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: "18px",
                  }}
                >
                  {language.flag}
                </span>

                <span
                  style={{
                    flex: 1,
                    fontSize: "14px",
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {language.name}
                </span>

                {isActive && (
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: "13px",
                      opacity: 0.9,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}