import "../utils/i18n"
import { clientRpc, markDisconnected, setClientImage, subscribeClientState } from "./client-rpc"
import "./client.css"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { useTranslation } from "react-i18next"

type ConnectionStatus = "connecting" | "connected" | "disconnected"

function statusMessage(status: ConnectionStatus, t: (key: string) => string) {
  if (status === "connecting") {
    return t("app.connecting")
  }

  if (status === "connected") {
    return t("app.connected")
  }

  return t("app.disconnected")
}

async function connectClient(setStatus: (status: ConnectionStatus) => void) {
  setStatus("connecting")

  try {
    const latestImage = await clientRpc.registerClient()
    if (latestImage) {
      setClientImage(latestImage)
      setStatus("connected")
    } else {
      setStatus("disconnected")
    }
  } catch {
    markDisconnected()
    setStatus("disconnected")
  }
}

function setupReconnectLoop(setStatus: (status: ConnectionStatus) => void) {
  setInterval(() => {
    void clientRpc
      .ping()
      .then(() => {
        setStatus("connected")
      })
      .catch(() => {
        markDisconnected()
        setStatus("disconnected")
        void connectClient(setStatus)
      })
  }, 2000)
}

function mountClient() {
  const rootElement = document.getElementById("root")
  if (!rootElement) {
    return
  }

  const root = createRoot(rootElement)
  const renderClient = (status: ConnectionStatus) => {
    root.render(<ClientApp status={status} />)
  }

  const setStatus = (status: ConnectionStatus) => {
    renderClient(status)
  }

  void connectClient(setStatus)
  setupReconnectLoop(setStatus)
}

function ClientApp({ status: initialStatus }: { status: ConnectionStatus }) {
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState("")
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus)

  useEffect(() => {
    const unsubscribe = subscribeClientState((state) => {
      setImageUrl(state.imageUrl)
      if (state.connected) {
        setStatus("connected")
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

  return (
    <main className="teleport-client">
      <section className="teleport-client__viewport">
        {imageUrl ? (
          <img src={imageUrl} alt="Teleport stream" className="teleport-client__image" />
        ) : (
          <div className="teleport-client__placeholder">{t("app.waiting")}</div>
        )}

        {status !== "connected" && (
          <div className={`teleport-client__status-badge teleport-client__status-badge--${status}`}>
            {statusMessage(status, t)}
          </div>
        )}
      </section>
    </main>
  )
}

mountClient()
