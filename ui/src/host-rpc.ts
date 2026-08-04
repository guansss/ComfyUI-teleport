import type { ClientFunctions } from "./client/client-rpc"
import { emitter } from "./events"
import { RPC_CHANNEL_NAME, RPC_PING_INTERVAL_MS } from "./shared"
import { createHostRpc } from "./utils/rpc"

const latestImagesByTeleportId = new Map<string, string>()

type RegisteredClient = {
  clientId: string
  teleportId: string
}

const clientsById = new Map<string, RegisteredClient>()

function getAvailableClients() {
  return Array.from(clientsById.values())
}

function emitClientsChanged() {
  emitter.dispatchEvent(
    new CustomEvent("clientsChanged", { detail: { clients: getAvailableClients() } }),
  )
}

const hostFunctions = new (class HostRpc {
  /**
   * @returns `true` if the client is registered, `false` otherwise
   */
  async ping(clientId: string): Promise<boolean> {
    const existingClient = clientsById.get(clientId)
    if (existingClient) {
      return true
    }
    return false
  }

  async registerClient({ clientId, teleportId }: { clientId: string; teleportId: string }) {
    const existingClient = clientsById.get(clientId)
    if (!existingClient) {
      clientsById.set(clientId, { clientId, teleportId })
      emitClientsChanged()
    } else {
      const teleportChanged = existingClient.teleportId !== teleportId
      existingClient.teleportId = teleportId
      if (teleportChanged) {
        emitClientsChanged()
      }
    }

    const latestImage = latestImagesByTeleportId.get(teleportId) ?? ""
    if (latestImage) {
      void hostRpc.broadcast.$ignoreTimeout.$callEvent("updateImage", latestImage, teleportId)
    }
  }
})()

export type HostFunctions = {
  [K in keyof typeof hostFunctions]: (typeof hostFunctions)[K]
}

export const hostRpc = createHostRpc<ClientFunctions, HostFunctions>(
  RPC_CHANNEL_NAME,
  hostFunctions,
  {
    clientStaleTimeoutMs: RPC_PING_INTERVAL_MS + 100,
    clientSweepIntervalMs: RPC_PING_INTERVAL_MS + 500,
    onClientAdded() {},
    onClientRemoved(clientId) {
      clientsById.delete(clientId)
      emitClientsChanged()
    },
  },
)

export { getAvailableClients }

export async function pushImageToClient(imageUrl: string, teleportId: string) {
  latestImagesByTeleportId.set(teleportId, imageUrl)
  await hostRpc.broadcast.$ignoreTimeout.$callEvent("updateImage", imageUrl, teleportId)
}
