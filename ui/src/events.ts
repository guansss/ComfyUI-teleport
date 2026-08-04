export type Events = {
  teleportIdChanged: CustomEvent<{
    nodeId: string
    teleportId: string
  }>
  clientsChanged: CustomEvent<{
    clients: Array<{
      clientId: string
      teleportId: string
    }>
  }>
}

export const emitter = new EventTarget() as {
  addEventListener<K extends keyof Events>(
    type: K,
    listener: (ev: Events[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener<K extends keyof Events>(
    type: K,
    listener: (ev: Events[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void
  dispatchEvent<K extends keyof Events>(event: Events[K]): boolean
}
