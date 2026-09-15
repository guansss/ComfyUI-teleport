type FunctionKey<T> = keyof {
  [K in keyof T as T[K] extends ((...args: any[]) => any) | undefined ? K : never]: 1
}

type InterceptedFunction<T extends (...args: any[]) => any> = T extends (
  ...args: infer A
) => infer R
  ? (...args: A | []) => R
  : never

export function intercept<T extends Record<string, any>, K extends FunctionKey<T>>(
  object: T,
  method: K,
  callback: (
    this: T,
    fn: InterceptedFunction<T[K]> | (undefined extends T[K] ? undefined : never),
    ...args: Parameters<T[K]>
  ) => ReturnType<T[K]>,
) {
  const original: T[K] | undefined = object[method]

  object[method] = function (this: T, ...args: Parameters<T[K]>) {
    if (original) {
      const fn = ((...newArgs) => {
        if (newArgs.length === 0) {
          return original.apply(this, args)
        }
        return original.apply(this, newArgs)
      }) as InterceptedFunction<T[K]>
      return callback.call(this, fn, ...args)
    } else {
      return callback.call(this, undefined as any, ...args)
    }
  } as T[K]
  object[method].__original = original
}
