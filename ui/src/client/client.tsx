import { I18NProvider } from "../i18n/I18NProvider"
import { useTranslation } from "../i18n/i18n"
import { connectionStatusAtom, imageUrlAtom, teleportIdAtom, useConnectionLoop } from "./client-rpc"
import "./client.css"
import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { createRoot } from "react-dom/client"

function mountClient() {
  const rootElement = document.getElementById("root")
  if (!rootElement) {
    return
  }

  const root = createRoot(rootElement)
  root.render(
    <I18NProvider>
      <ClientApp />
    </I18NProvider>,
  )
}

function ClientApp() {
  const t = useTranslation()
  const teleportId = useAtomValue(teleportIdAtom)
  const status = useAtomValue(connectionStatusAtom)
  const imageUrl = useAtomValue(imageUrlAtom)

  useConnectionLoop()

  useEffect(() => {
    document.title = `Teleport - ${teleportId}`
  }, [teleportId])

  return (
    <main className="teleport-client">
      <section className="teleport-client__viewport">
        {imageUrl ? (
          <img src={imageUrl} alt="Teleport stream" className="teleport-client__image" />
        ) : (
          <div className="teleport-client__placeholder">{t.app.waiting}</div>
        )}

        {status !== "connected" && (
          <div className={`teleport-client__status-badge teleport-client__status-badge--${status}`}>
            {t.app.connecting}
          </div>
        )}
      </section>
    </main>
  )
}

mountClient()
