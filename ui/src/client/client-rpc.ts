import type { HostFunctions } from "../host-rpc"
import { createRpc } from "../utils/rpc"

type ClientState = {
  imageUrl: string
  connected: boolean
  clientId: string
}

const listeners = new Set<(state: ClientState) => void>()
const state: ClientState = {
  imageUrl: "",
  connected: false,
  clientId: "",
}

function emit() {
  for (const listener of listeners) {
    listener({ ...state })
  }
}

const clientFunctions = new (class {
  async updateImage(imageUrl: string, clientId: string) {
    if (state.clientId && clientId && state.clientId !== clientId) {
      return
    }

    state.imageUrl = imageUrl
    state.connected = true
    emit()
  }

  async ping(clientId: string) {
    if (state.clientId && clientId && state.clientId !== clientId) {
      return "pong"
    }

    state.connected = true
    emit()
    return "pong"
  }
})()

export type ClientFunctions = {
  [K in keyof typeof clientFunctions]: (typeof clientFunctions)[K]
}

export const clientRpc = createRpc<HostFunctions, ClientFunctions>(clientFunctions)

export function subscribeClientState(listener: (state: ClientState) => void) {
  listeners.add(listener)
  listener({ ...state })

  return () => {
    listeners.delete(listener)
  }
}

export function markDisconnected() {
  state.connected = false
  emit()
}

export function setClientId(clientId: string) {
  state.clientId = clientId
  emit()
}

export function setClientImage(imageUrl: string) {
  state.imageUrl = imageUrl
  state.connected = true
  emit()
}
