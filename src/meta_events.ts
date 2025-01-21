import type { Listener } from '@/interface.ts'
import type { Emitter, EventName } from '@/mod.ts'

type ListenerChangedEventContext = {
  /**
   * 事件名称，`onAny` 和 `offAny` 时没有名称
   */
  eventName?: EventName
  /**
   * 事件监听器
   */
  listener: Listener
}

export type MetaEventMap = {
  [listenerAdded]: [ListenerChangedEventContext]
  [listenerRemoved]: [ListenerChangedEventContext]
}

export const listenerAdded = Symbol('listenerAdded')
export const listenerRemoved = Symbol('listenerRemoved')

type MetaEventNames = keyof MetaEventMap
export const isMetaEvent = (eventName: unknown): eventName is MetaEventNames => {
  return eventName === listenerAdded || eventName === listenerRemoved
}

export let canEmitMetaEvents = false
export function emitMetaEvent(
  // deno-lint-ignore no-explicit-any
  instance: Emitter<any>,
  eventName: MetaEventNames,
  ctx: ListenerChangedEventContext,
) {
  if (isMetaEvent(eventName)) {
    try {
      canEmitMetaEvents = true
      ;(instance as Emitter<MetaEventMap>).emit(eventName, ctx)
    } finally {
      canEmitMetaEvents = false
    }
  }
}
