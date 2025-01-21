import type { Listener } from '@/interface.ts'
import type { EventName } from '@/mod.ts'

export const castArray = <T>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value]
}

export const isEventNameType = (name: unknown): name is EventName => {
  return typeof name === 'string' || typeof name === 'symbol' || typeof name === 'number'
}

export function assertEventName(eventName: unknown): asserts eventName is EventName {
  if (!isEventNameType(eventName)) {
    throw new TypeError('`eventName` must be a string, symbol, or number')
  }
}

export function assertListener(listener: unknown): asserts listener is Listener {
  if (typeof listener !== 'function') {
    throw new TypeError('listener must be a function')
  }
}
