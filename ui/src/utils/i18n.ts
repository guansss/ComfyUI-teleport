import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import Backend from "i18next-http-backend"
import { initReactI18next } from "react-i18next"

type FallbackResources = Record<string, Record<string, Record<string, unknown>>>

const fallbackResources: FallbackResources = {
  en: {
    main: {
      app: {
        title: "Teleport Viewer",
        connecting: "Connecting to host...",
        connected: "Connected",
        disconnected: "Disconnected. Retrying...",
        waiting: "Waiting for image stream...",
      },
    },
  },
}

// Initialize i18next
void i18n
  // Load translations via http backend (must be first!)
  .use(Backend)
  // Detect user language
  .use(LanguageDetector)
  // Initialize react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    debug: false,

    // Fallback language
    fallbackLng: "en",

    // Namespace for translations
    ns: ["main"],
    defaultNS: "main",

    // Do not load from bundled resources first
    initImmediate: true,

    // Custom handling for missing keys
    saveMissing: false,

    // Language detection configuration
    detection: {
      // Order of detection methods
      order: ["navigator", "htmlTag", "path", "subdomain"],
      // Don't cache detected language
      caches: [],
    },

    // Backend configuration
    backend: {
      // Path to load translations from
      loadPath: "/locales/{{lng}}/{{ns}}.json",
      // Add retry logic
      requestOptions: {
        retry: 3,
        timeout: 3000,
      },
    },

    // React specific options
    react: {
      useSuspense: true,
    },

    resources: fallbackResources,

    // Allow string formatting for dynamic values
    interpolation: {
      escapeValue: false, // Not needed for React as it escapes by default
    },
  })

// Add fallback resources only if HTTP loading fails
i18n.on("failedLoading", (lng, ns) => {
  console.log(`Failed loading translation file for ${lng} and ${ns}, using fallback`)

  // Add the fallback resources for this language
  if (fallbackResources[lng] && fallbackResources[lng][ns]) {
    i18n.addResourceBundle(lng, ns, fallbackResources[lng][ns], true, true)
  }
})

export default i18n
