import { type BirpcOptions, type BirpcReturn, createBirpc } from "birpc"

const channel = new BroadcastChannel("ComfyUI-teleport")

type Rpc<T extends Record<string, unknown>, U extends Record<string, unknown>> = BirpcReturn<
  T,
  U
> & {
  $: (options: RpcOptions) => BirpcReturn<T, U>
  ignoreTimeout: BirpcReturn<T, U>
}

type RpcOptions = {
  ignoreTimeout?: boolean
}

export function createRpc<
  RemoteFunctions extends Record<string, unknown> = Record<string, unknown>,
  LocalFunctions extends Record<string, unknown> = Record<string, unknown>,
>(
  functions: LocalFunctions,
  options?: Partial<BirpcOptions<RemoteFunctions>>,
): Rpc<RemoteFunctions, LocalFunctions> {
  const baseRpc = createBirpc<RemoteFunctions, LocalFunctions>(functions, {
    on: (on) => (channel.onmessage = (e) => on(e.data)),
    post: (msg) => channel.postMessage(msg),
    timeout: 1000,
    ...options,
  })

  const withOptions = (options: RpcOptions) => {
    return new Proxy(baseRpc, {
      get(_, prop) {
        const fn = Reflect.get(baseRpc, prop)

        if (typeof fn !== "function") {
          return fn
        }

        return async (...args: unknown[]) => {
          try {
            return await (fn as (...args: unknown[]) => Promise<void>).call(baseRpc, ...args)
          } catch (e) {
            if (options.ignoreTimeout && isBirpcTimeoutError(e)) {
              // ignore
            } else {
              throw e
            }
          }
        }
      },
    })
  }

  const rpc = new Proxy(baseRpc, {
    get(_, prop) {
      if (prop === "$") {
        return withOptions
      } else if (prop === "ignoreTimeout") {
        return withOptions({ ignoreTimeout: true })
      }

      return Reflect.get(baseRpc, prop)
    },
  })

  return rpc as Rpc<RemoteFunctions, LocalFunctions>
}

function isBirpcTimeoutError(e: unknown) {
  return String(e).includes("[birpc] timeout")
}
