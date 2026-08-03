import type { ClientFunctions } from "./client/client-rpc"
import { createRpc } from "./utils/rpc"

const latestImagesById = new Map<string, string>()

const hostFunctions = new (class HostRpc {
  async ping(clientId: string) {
    return "pong"
  }

  async registerClient(clientId: string) {
    const latestImage = latestImagesById.get(clientId) ?? ""
    if (latestImage) {
      await hostRpc.ignoreTimeout.updateImage(latestImage, clientId)
    }

    return latestImage
  }
})()

export type HostFunctions = {
  [K in keyof typeof hostFunctions]: (typeof hostFunctions)[K]
}

export const hostRpc = createRpc<ClientFunctions, HostFunctions>(hostFunctions)

export async function pushImageToClient(imageUrl: string, clientId: string) {
  latestImagesById.set(clientId, imageUrl)
  await hostRpc.ignoreTimeout.updateImage(imageUrl, clientId)
}
