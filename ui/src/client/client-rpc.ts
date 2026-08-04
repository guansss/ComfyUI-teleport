import type { HostFunctions } from "../host-rpc"
import { FALLBACK_TELEPORT_ID, RPC_CHANNEL_NAME, RPC_PING_INTERVAL_MS, WINDOW_ID } from "../shared"
import { createClientRpc } from "../utils/rpc"
import { atom, getDefaultStore, useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"

type ConnectionStatus = "connecting" | "connected"

export const imageUrlAtom = atom<string>("")
export const connectionStatusAtom = atom<ConnectionStatus>("connecting")
export const teleportIdAtom = atom<string>(getTeleportIdFromUrl() || FALLBACK_TELEPORT_ID)

function getTeleportIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get("teleportId")?.trim()
}

export type ClientFunctions = {
  updateImage(imageUrl: string, teleportId: string): Promise<boolean>
}

function createRpc() {
  const store = getDefaultStore()

  const clientFunctions = new (class {
    async updateImage(imageUrl: string, teleportId: string) {
      const localTeleportId = store.get(teleportIdAtom)
      if (localTeleportId && teleportId && localTeleportId !== teleportId) {
        return false
      }

      store.set(imageUrlAtom, imageUrl)
      return true
    }
  })()

  const rpc = createClientRpc<HostFunctions, ClientFunctions>(
    RPC_CHANNEL_NAME,
    WINDOW_ID,
    clientFunctions,
  )
  return rpc
}

export const clientRpc = createRpc()

function registerClient(teleportId: string) {
  return clientRpc.$ignoreTimeout.$callEvent("registerClient", {
    clientId: WINDOW_ID,
    teleportId,
  })
}

export function useConnectionLoop() {
  const teleportId = useAtomValue(teleportIdAtom)
  const setStatus = useSetAtom(connectionStatusAtom)

  useEffect(() => {
    const run = () => {
      void clientRpc
        .ping(WINDOW_ID)
        .then((registered) => {
          setStatus("connected")
          if (!registered) {
            void registerClient(teleportId)
          }
        })
        .catch((e) => {
          console.warn("Failed to ping host:", e)
          setStatus("connecting")
        })
    }
    const timer = setInterval(run, RPC_PING_INTERVAL_MS)
    run()
    return () => clearInterval(timer)
  }, [teleportId])
}
