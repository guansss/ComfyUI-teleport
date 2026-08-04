export const WINDOW_ID = crypto.randomUUID()
export const FALLBACK_TELEPORT_ID = ""

export const RPC_CHANNEL_NAME = "comfyui-teleport-rpc"
export const RPC_PING_INTERVAL_MS = 1000

export function getWebDir() {
  return `/extensions/${__EXTENSION_NAME__}`
}
