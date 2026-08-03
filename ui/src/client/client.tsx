import "../utils/i18n"
import {
  clientRpc,
  markDisconnected,
  setClientId,
  setClientImage,
  subscribeClientState,
} from "./client-rpc"
import "./client.css"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { useTranslation } from "react-i18next"

type ConnectionStatus = "connecting" | "connected" | "disconnected"

function getTeleportIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get("teleportId")?.trim() || "default"
}

function statusMessage(status: ConnectionStatus, t: (key: string) => string) {
  if (status === "connecting") {
    return t("app.connecting")
  }

  if (status === "connected") {
    return t("app.connected")
  }

  return t("app.disconnected")
}

async function connectClient(setStatus: (status: ConnectionStatus) => void, clientId: string) {
  setStatus("connecting")

  try {
    const latestImage = await clientRpc.registerClient(clientId)
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

function setupReconnectLoop(setStatus: (status: ConnectionStatus) => void, clientId: string) {
  setInterval(() => {
    void clientRpc
      .ping(clientId)
      .then(() => {
        setStatus("connected")
      })
      .catch(() => {
        markDisconnected()
        setStatus("disconnected")
        void connectClient(setStatus, clientId)
      })
  }, 2000)
}

function mountClient() {
  const rootElement = document.getElementById("root")
  if (!rootElement) {
    return
  }

  const clientId = getTeleportIdFromUrl()
  setClientId(clientId)
  document.title = `Teleport - ${clientId}`

  const root = createRoot(rootElement)
  const renderClient = (status: ConnectionStatus) => {
    root.render(<ClientApp status={status} clientId={clientId} />)
  }

  const setStatus = (status: ConnectionStatus) => {
    renderClient(status)
  }

  void connectClient(setStatus, clientId)
  setupReconnectLoop(setStatus, clientId)
}

function ClientApp({
  status: initialStatus,
  clientId,
}: {
  status: ConnectionStatus
  clientId: string
}) {
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

  useEffect(() => {
    document.title = `Teleport - ${clientId}`
  }, [clientId])

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
