import type { ClientFunctions } from "./client/client-rpc"
import { createRpc } from "./utils/rpc"

let latestImage = ""

const hostFunctions = new (class HostRpc {
  async ping() {
    return "pong"
  }

  async registerClient() {
    if (latestImage) {
      await hostRpc.ignoreTimeout.updateImage(latestImage)
    }

    return latestImage
  }
})()

export type HostFunctions = {
  [K in keyof typeof hostFunctions]: (typeof hostFunctions)[K]
}

export const hostRpc = createRpc<ClientFunctions, HostFunctions>(hostFunctions)

export async function pushImageToClient(imageUrl: string) {
  latestImage = imageUrl
  await hostRpc.ignoreTimeout.updateImage(imageUrl)
}
