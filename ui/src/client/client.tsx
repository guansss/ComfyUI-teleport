import { RPC_PING_INTERVAL_MS, WINDOW_ID } from "../shared"
import "../utils/i18n"
import { clientRpc, setConnected, setTeleportId, subscribeClientState } from "./client-rpc"
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

async function connectClient(setStatus: (status: ConnectionStatus) => void, teleportId: string) {
  setStatus("connecting")

  try {
    await clientRpc.registerClient({ clientId: WINDOW_ID, teleportId })
    setConnected(true)
  } catch (e) {
    console.warn("Failed to register client:", e)
    setConnected(false)
  }
}

function setupReconnectLoop(setStatus: (status: ConnectionStatus) => void, teleportId: string) {
  setInterval(() => {
    void clientRpc
      .ping(WINDOW_ID)
      .then((registered) => {
        setConnected(true)
        if (!registered) {
          void connectClient(setStatus, teleportId)
        }
      })
      .catch((e) => {
        console.warn("Failed to ping host:", e)
        setConnected(false)
        void connectClient(setStatus, teleportId)
      })
  }, RPC_PING_INTERVAL_MS)
}

function mountClient() {
  const rootElement = document.getElementById("root")
  if (!rootElement) {
    return
  }

  const teleportId = getTeleportIdFromUrl()
  setTeleportId(teleportId)
  document.title = `Teleport - ${teleportId}`

  const root = createRoot(rootElement)
  const renderClient = (status: ConnectionStatus) => {
    root.render(<ClientApp status={status} teleportId={teleportId} />)
  }

  const setStatus = (status: ConnectionStatus) => {
    renderClient(status)
  }

  void connectClient(setStatus, teleportId)
  setupReconnectLoop(setStatus, teleportId)
}

function ClientApp({
  status: initialStatus,
  teleportId,
}: {
  status: ConnectionStatus
  teleportId: string
}) {
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState("")
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus)

  useEffect(() => {
    const unsubscribe = subscribeClientState((state) => {
      setImageUrl(state.imageUrl)
      if (state.connected) {
        setStatus("connected")
      } else {
        setStatus("disconnected")
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    document.title = `Teleport - ${teleportId}`
  }, [teleportId])

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
