import type { ClientFunctions } from "./client/client-rpc"
import { createRpc } from "./utils/rpc"

// using a class since decorators can only be used in classes (currently)
const hostFunctions = new (class HostRpc {
  async initClient() {
    await hostRpc.ping()
  }
})()

export type HostFunctions = {
  [K in keyof typeof hostFunctions]: (typeof hostFunctions)[K]
}

export const hostRpc = createRpc<ClientFunctions, HostFunctions>(hostFunctions)
