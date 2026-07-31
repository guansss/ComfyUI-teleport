import type { HostFunctions } from "../host-rpc"
import { createRpc } from "../utils/rpc"

const clientFunctions = new (class {
  async ping() {
    return "pong"
  }
})()

export type ClientFunctions = {
  [K in keyof typeof clientFunctions]: (typeof clientFunctions)[K]
}

export const clientRpc = createRpc<HostFunctions, ClientFunctions>(clientFunctions)
