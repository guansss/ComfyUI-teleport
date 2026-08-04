import {
  type BirpcOptions,
  type BirpcReturn,
  ChannelOptions,
  createBirpc,
  createBirpcGroup,
  EventOptions,
} from "birpc"

const defaultOptions = {
  timeout: 1000,
  clientStaleTimeoutMs: 6500,
  clientSweepIntervalMs: 2000,
} satisfies Partial<BirpcOptions> & HostRpcOptions

type WithOptions<T> = T & {
  $: (options: RpcCallOptions) => T
  $ignoreTimeout: T
}

interface RpcCallOptions {
  ignoreTimeout?: boolean
  beforeCall?: (prop: string | symbol, fn: (...args: unknown[]) => unknown) => void
}

function withCallOptions<T extends Record<string, unknown>>(
  functions: T,
  bindOptions: (options: RpcCallOptions) => T,
): WithOptions<T> {
  const proxied = new Proxy(functions, {
    get(_, prop) {
      if (prop === "$") {
        return bindOptions
      } else if (prop === "$ignoreTimeout") {
        return bindOptions({ ignoreTimeout: true })
      }

      return Reflect.get(functions, prop)
    },
  })
  return proxied as unknown as WithOptions<T>
}

function applyCallOptions<T extends Record<string, unknown>>(
  functions: T,
  options: RpcCallOptions,
): T {
  return new Proxy(functions, {
    get(_, prop) {
      const fn = Reflect.get(functions, prop)

      if (typeof fn !== "function") {
        return fn
      }

      return async (...args: unknown[]) => {
        try {
          options.beforeCall?.(prop, fn as (...args: unknown[]) => unknown)
          return await (fn as (...args: unknown[]) => Promise<unknown>).call(functions, ...args)
        } catch (e) {
          if (options.ignoreTimeout && isBirpcTimeoutError(e)) {
            return undefined
          } else {
            throw e
          }
        }
      }
    },
  })
}

export function createClientRpc<
  RemoteFunctions extends Record<string, unknown> = Record<string, unknown>,
  LocalFunctions extends Record<string, unknown> = Record<string, unknown>,
>(name: string, id: string, functions: LocalFunctions, options?: BirpcOptions<RemoteFunctions>) {
  const broadcastChannel = new BroadcastChannel(name)
  const rpc = createBirpc<RemoteFunctions, LocalFunctions>(functions, {
    ...defaultOptions,
    on: (on) => {
      broadcastChannel.onmessage = (e) => {
        if (e.data?.clientId === id) {
          on(e.data.data)
        }
      }
    },
    post: (msg) => {
      broadcastChannel.postMessage({ clientId: id, data: msg })
    },
    ...options,
  })
  return withCallOptions(rpc, (opt) => applyCallOptions(rpc, opt))
}

interface HostRpcOptions {
  clientStaleTimeoutMs?: number
  clientSweepIntervalMs?: number
  onClientAdded?: (clientId: string) => void
  onClientRemoved?: (clientId: string) => void
}

interface ClientInfo {
  clientId: string
  lastSeenAt: number
  release: () => void
}

export function createHostRpc<
  RemoteFunctions extends Record<string, unknown> = Record<string, unknown>,
  LocalFunctions extends Record<string, unknown> = Record<string, unknown>,
>(
  name: string,
  functions: LocalFunctions,
  options?: HostRpcOptions & Partial<BirpcOptions<RemoteFunctions>>,
) {
  options = { ...defaultOptions, ...options }

  type Meta = { client?: ClientInfo }
  type Channel = Omit<ChannelOptions, "meta"> & {
    meta: Meta
    onTimeoutError?: EventOptions<RemoteFunctions, LocalFunctions>["onTimeoutError"]
  }
  const channels: Channel[] = []
  const broadcastChannel = new BroadcastChannel(name)
  let currentCallOptions: RpcCallOptions = {}

  channels.map = function <T>(
    callback: (channel: Channel, index: number, array: Channel[]) => T,
  ): T[] {
    return Array.prototype.map.call(this, (...args) => {
      const result = callback(...args)
      if ((result as BirpcReturn)?.$call) {
        return applyCallOptions(result as BirpcReturn, currentCallOptions)
      }
      return result
    }) as T[]
  }
  channels.push({
    ...options,
    // a channel without clientId for receiving messages from clients that haven't registered yet
    meta: {},
    on: () => {
      broadcastChannel.addEventListener("message", (e) => {
        const clientId = e.data?.clientId
        if (clientId) {
          if (channels.some((c) => c.meta.client?.clientId === clientId)) {
            // let the existing channel handle this message
            return
          }
          let handler: ((e: MessageEvent) => void) | undefined
          const channel: Channel = {
            ...options,
            meta: {
              client: {
                clientId,
                lastSeenAt: Date.now(),
                release: () => {
                  if (handler) {
                    broadcastChannel.removeEventListener("message", handler)
                  }
                },
              },
            },
            on: (on) => {
              handler = (e: MessageEvent) => {
                if (e.data?.clientId === channel.meta.client!.clientId) {
                  channel.meta.client!.lastSeenAt = Date.now()
                  on(e.data.data)
                }
              }
              broadcastChannel.addEventListener("message", handler)
            },
            post: (msg) => {
              broadcastChannel.postMessage({ clientId, data: msg })
            },
            onTimeoutError(functionName, args) {
              console.warn(
                `Timeout error for client ${clientId} on function ${String(functionName)}`,
              )
              removeClient(clientId)
              return options?.onTimeoutError?.call(this, functionName, args)
            },
          }
          rpc.updateChannels(() => {
            channels.push(channel)
          })
          // reading .clients triggers an internal rpc instance to be created for this channel,
          // and then the handler will be set up
          void rpc.clients
          handler?.(e)
          options?.onClientAdded?.(clientId)
        } else {
          // messages without clientId are ignored
        }
      })
    },
    // do not send anything from this channel
    post: () => {},
  })

  const sweepingInterval = options?.clientSweepIntervalMs ?? defaultOptions.clientSweepIntervalMs
  const staleTimeout = options?.clientStaleTimeoutMs ?? defaultOptions.clientStaleTimeoutMs

  function removeClient(clientId: string) {
    const index = channels.findIndex((c) => c.meta.client?.clientId === clientId)
    if (index !== -1) {
      channels.splice(index, 1)
      options?.onClientRemoved?.(clientId)
    }
  }

  function pruneStaleClients(now = Date.now()) {
    const staleChannels = channels.filter(
      (c) => c.meta.client && now - c.meta.client.lastSeenAt > staleTimeout,
    )
    for (const channel of staleChannels) {
      const clientId = channel.meta.client!.clientId
      removeClient(clientId)
    }
  }
  setInterval(() => pruneStaleClients(), sweepingInterval)

  const rpc = createBirpcGroup<RemoteFunctions, LocalFunctions>(functions, channels, options)
  const _broadcast = rpc.broadcast
  const broadcast = withCallOptions(_broadcast, (opt) => {
    return applyCallOptions(_broadcast, {
      beforeCall(prop, fn) {
        currentCallOptions = opt
        opt.beforeCall?.(prop, fn)
      },
    })
  })
  return {
    ...rpc,
    get clientInfos() {
      return channels.map((c) => c.meta.client).filter((client): client is ClientInfo => !!client)
    },
    broadcast,
  }
}

function isBirpcTimeoutError(e: unknown) {
  return String(e).includes("[birpc] timeout")
}
