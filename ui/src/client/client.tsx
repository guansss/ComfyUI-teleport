import { clientRpc } from "./client-rpc"
import "./client.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

async function client() {
  try {
    await clientRpc.initClient()
  } catch (e) {
    console.error("Failed to initialize client", e)
  }

  const root = createRoot(document.getElementById("root")!)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

function App() {
  return <div className="relative flex w-screen h-screen"></div>
}

client().catch(console.warn)
