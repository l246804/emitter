import type { Listener } from '@/interface.ts'
import type { Emitter, EventName } from '@/mod.ts'
import type { Producer } from '@/producer.ts'

// deno-lint-ignore no-explicit-any
type Instance = Emitter<any>

export const listenersMap = new WeakMap<Instance, Map<EventName, Listener[]>>()
export const anyListenersMap = new WeakMap<Instance, Listener[]>()
export const producersMap = new WeakMap<Instance, Map<EventName, Set<Producer>>>()

export const getListeners = (instance: Instance) => listenersMap.get(instance)
export const getAnyListeners = (instance: Instance) => anyListenersMap.get(instance)
export const getProducers = (instance: Instance) => producersMap.get(instance)

export const anyProducer = Symbol('anyProducer')

export const enqueueProducers = (instance: Instance, eventName: EventName, args: unknown[]) => {
  const producers = producersMap.get(instance)
  if (!producers) return

  if (producers.has(eventName)) {
    for (const producer of producers.get(eventName)!) {
      producer.enqueue(args)
    }
  }

  if (producers.has(anyProducer)) {
    args = [eventName, ...args]
    for (const producer of producers.get(anyProducer)!) {
      producer.enqueue(args)
    }
  }
}
