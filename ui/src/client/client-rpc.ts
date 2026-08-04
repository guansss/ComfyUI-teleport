import type { HostFunctions } from "../host-rpc"
import { RPC_CHANNEL_NAME, WINDOW_ID } from "../shared"
import { createClientRpc } from "../utils/rpc"

type ClientState = {
  imageUrl: string
  connected: boolean
  teleportId: string
}

const listeners = new Set<(state: ClientState) => void>()
const state: ClientState = {
  imageUrl: "",
  connected: false,
  teleportId: "",
}

function emit() {
  for (const listener of listeners) {
    listener({ ...state })
  }
}

const clientFunctions = new (class {
  async updateImage(imageUrl: string, teleportId: string) {
    if (state.teleportId && teleportId && state.teleportId !== teleportId) {
      return false
    }

    state.imageUrl = imageUrl
    emit()
    return true
  }
})()

export type ClientFunctions = {
  [K in keyof typeof clientFunctions]: (typeof clientFunctions)[K]
}

export const clientRpc = createClientRpc<HostFunctions, ClientFunctions>(
  RPC_CHANNEL_NAME,
  WINDOW_ID,
  clientFunctions,
)

export function subscribeClientState(listener: (state: ClientState) => void) {
  listeners.add(listener)
  listener({ ...state })

  return () => {
    listeners.delete(listener)
  }
}

export function setConnected(connected: boolean) {
  state.connected = connected
  emit()
}

export function setTeleportId(teleportId: string) {
  state.teleportId = teleportId
  emit()
}

export function setClientImage(imageUrl: string) {
  state.imageUrl = imageUrl
  emit()
}
