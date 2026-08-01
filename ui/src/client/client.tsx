import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import "../utils/i18n"
import { clientRpc, markDisconnected, setClientImage, subscribeClientState } from "./client-rpc"
import "./client.css"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { useTranslation } from "react-i18next"

type ConnectionStatus = "connecting" | "connected" | "disconnected"

function ClientApp() {
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState("")
  const [status, setStatus] = useState<ConnectionStatus>("connecting")

  useEffect(() => {
    const unsubscribe = subscribeClientState((state) => {
      setImageUrl(state.imageUrl)
      setStatus(state.connected ? "connected" : "disconnected")
    })

    return unsubscribe
  }, [])

  return (
    <main className="teleport-client">
      <Card className="teleport-client__shell">
        <CardHeader>
          <div className="teleport-client__header-row">
            <CardTitle>{t("app.title")}</CardTitle>
            <Badge
              variant={
                status === "connected"
                  ? "default"
                  : status === "connecting"
                    ? "secondary"
                    : "destructive"
              }
            >
              {statusMessage(status, t)}
            </Badge>
          </div>
          <CardDescription>{statusMessage(status, t)}</CardDescription>
        </CardHeader>
        <CardContent>
          <section className="teleport-client__content">
            {imageUrl ? (
              <img src={imageUrl} alt="Teleport stream" className="teleport-client__image" />
            ) : (
              <div className="teleport-client__placeholder">{t("app.waiting")}</div>
            )}
          </section>
        </CardContent>
      </Card>
    </main>
  )
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

async function connectClient() {
  try {
    const latestImage = await clientRpc.registerClient()
    if (latestImage) {
      setClientImage(latestImage)
    }
  } catch {
    markDisconnected()
  }
}

function setupReconnectLoop() {
  setInterval(() => {
    void clientRpc
      .ping()
      .then(() => {
        // ping succeeded
      })
      .catch(() => {
        markDisconnected()
        void connectClient()
      })
  }, 2000)
}

void connectClient()
setupReconnectLoop()

createRoot(document.getElementById("root")!).render(<ClientApp />)
