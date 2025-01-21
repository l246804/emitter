import type { ActionType, Debug } from '@/debug.ts'
import type { Listener, NormalizeEventParams } from '@/interface.ts'
import {
  anyListenersMap,
  anyProducer,
  enqueueProducers,
  getAnyListeners,
  getListeners,
  getProducers,
  listenersMap,
  producersMap,
} from '@/maps.ts'
import {
  canEmitMetaEvents,
  emitMetaEvent,
  isMetaEvent,
  listenerAdded,
  listenerRemoved,
  type MetaEventMap,
} from '@/meta_events.ts'
import { createProducer } from '@/producer.ts'
import { assertEventName, assertListener, castArray, isEventNameType } from '@/utils.ts'

/**
 * 事件名称类型
 */
export type EventName = PropertyKey

/**
 * 取消订阅事件句柄类型
 */
export type UnsubscribeHandle = () => void

/**
 * 事件监听器执行顺序
 */
export type ListenerEnforce = 'before' | 'after'

/**
 * 注册事件监听器的配置项
 */
export interface OnListenerOptions {
  /**
   * 终止事件监听器的 {@link AbortSignal AbortSignal} 实例
   */
  signal?: AbortSignal
  /**
   * 事件监听器的执行顺序
   * - 'before': 向队列头部插入监听器
   * - 'after': 向队列尾部插入监听器
   * @default 'after'
   */
  enforce?: ListenerEnforce
  /**
   * 是否只执行一次，执行后自动取消订阅
   */
  once?: boolean
}

/**
 * Emitter 配置项
 */
export interface EmitterOptions {
  /**
   * 调试模块
   * @example
   * ```ts
   * const emitter = new EventEmitter({
   *   debug: new DebugImpl({ enabled: true })
   * })
   * ```
   */
  debug?: Debug
}

/**
 * 事件触发器
 * @example
 * ```ts
 * // 定义事件映射关系
 * interface EventMap {
 *   // 事件名称: 事件参数列表
 *   test: [string]
 *
 *   // 事件没有参数时可以设为 `[]`、`void` 或 `undefined`
 *   test2: void
 * }
 *
 * const events = new Emitter<EventMap>()
 *
 * // 注册事件
 * events.on('test', (str) => {
 *   console.log(str)
 *   // => 'hello world'
 * })
 *
 * // 触发事件
 * events.emit('test', 'hello world')
 * ```
 */
// deno-lint-ignore no-explicit-any
export class Emitter<EventMap = Record<EventName, any[]>, AllEventMap = EventMap & MetaEventMap> {
  constructor(private _options: EmitterOptions = {}) {
    listenersMap.set(this, new Map())
    anyListenersMap.set(this, [])
    producersMap.set(this, new Map())
  }

  /**
   * 元事件名称 - 添加监听器时触发
   */
  static get listenerAdded(): typeof listenerAdded {
    return listenerAdded
  }

  /**
   * 元事件名称 - 移除监听器时触发
   */
  static get listenerRemoved(): typeof listenerRemoved {
    return listenerRemoved
  }

  /**
   * 调试模块，用于输出调试信息
   * @example
   * ```ts
   * const events = new Emitter({
   *   // 使用内置的调试模块
   *   debug: new DebugImpl()
   *   // 使用自定义的调试模块
   *   debug: {
   *     enabled: true,
   *     logger(type, eventName, eventArgs) {
   *       // ...
   *     }
   *   }
   * })
   *
   * // 关闭调试模块
   * events.debug.enabled = false
   * ```
   */
  get debug(): Debug | undefined {
    return this._options.debug
  }

  /**
   * 启用调试模块时输出调试信息
   * @param type 操作类型
   * @param eventName 事件名称，部分操作类型不会有事件名称
   * @param eventArgs 事件参数列表，部分操作类型不会有事件参数
   */
  logIfDebugEnabled(type: ActionType, eventName?: EventName, eventArgs?: unknown[]): void {
    if (this.debug?.enabled) {
      this.debug.logger(type, eventName, eventArgs)
    }
  }

  private _addListener(
    enforce: ListenerEnforce = 'after',
    listeners: Listener[],
    listener: Listener,
  ): void {
    switch (enforce) {
      case 'before': {
        if (listeners.includes(listener)) {
          listeners.splice(listeners.indexOf(listener), 1)
        }
        listeners.unshift(listener)
        break
      }

      case 'after': {
        if (!listeners.includes(listener)) {
          listeners.push(listener)
        }
        break
      }
    }
  }

  /**
   * 注册事件监听器
   * @param eventName 事件名称，支持多个事件名称
   * @param listener 监听器
   * @param options 注册监听器配置项
   *
   * @returns 移除事件监听器句柄
   *
   * @example
   * ```ts
   * const events = new Emitter()
   *
   * // 注册事件监听器
   * events.on('test', () => {})
   *
   * // 注册多个事件监听器
   * events.on(['test', 'test2', 'test3'], () => {})
   *
   * // 注册事件监听器并指定执行顺序
   * events.on('test', () => {}, { enforce: 'before' })
   *
   * // 注册单次事件监听器
   * events.on('test', () => {}, { once: true })
   *
   * // 注册事件监听器并使用 AbortSignal 终止监听器
   * events.on('test', () => {}, { signal: AbortSignal.timeout(5000) })
   * ```
   */
  on<Name extends keyof AllEventMap>(
    eventName: Name | readonly Name[],
    listener: Listener<NormalizeEventParams<AllEventMap[Name]>>,
    { enforce, signal, once }: OnListenerOptions = {},
  ): UnsubscribeHandle {
    assertListener(listener)

    if (once) {
      const rawListener = listener
      listener = function (...args) {
        off()
        return rawListener.apply(this, args)
      }
    }

    const eventNames = castArray(eventName as EventName)
    for (const eventName of eventNames) {
      assertEventName(eventName)

      let arr = getListeners(this)?.get(eventName)
      if (!arr) {
        arr = []
        listenersMap.get(this)?.set(eventName, arr)
      }

      this._addListener(enforce, arr, listener)

      this.logIfDebugEnabled('subscribe', eventName)

      !isMetaEvent(eventName) && emitMetaEvent(this, listenerAdded, { eventName, listener })
    }

    const off = () => {
      this.off(eventName, listener)
      signal?.removeEventListener('abort', off)
    }

    if (signal) {
      signal.addEventListener('abort', off, { once: true })
      signal.aborted && off()
    }

    return off
  }

  private _removeListener(listeners: Listener[], listener: Listener): void {
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  /**
   * 移除事件监听器
   * @param eventName 事件名称，支持多个事件名称
   * @param listener 监听器
   *
   * @example
   * ```ts
   * const events = new Emitter()
   *
   * const listener = () => {}
   *
   * // 移除事件监听器
   * events.off('test', listener)
   *
   * // 移除多个事件监听器
   * events.off(['test', 'test2'], listener)
   * ```
   */
  off<Name extends keyof AllEventMap>(
    eventName: Name | readonly Name[],
    listener: Listener<NormalizeEventParams<AllEventMap[Name]>>,
  ): void {
    assertListener(listener)

    const eventNames = castArray(eventName as EventName)
    for (const eventName of eventNames) {
      assertEventName(eventName)

      const arr = getListeners(this)?.get(eventName)
      if (arr) {
        this._removeListener(arr, listener)
        !arr.length && listenersMap.get(this)?.delete(eventName)
      }

      this.logIfDebugEnabled('unsubscribe', eventName)

      !isMetaEvent(eventName) && emitMetaEvent(this, listenerRemoved, { eventName, listener })
    }
  }

  /**
   * 触发一个事件，所有监听器并行执行
   * @param eventName 事件名称
   * @param eventArgs 事件参数列表
   *
   * @returns 返回一个 {@link Promise Promise}，当所有监听器执行完毕后 resolve
   *
   * @example
   * ```ts
   * const events = new Emitter()
   *
   * let count = 0
   *
   * events.on('test', () => {
   *   count++
   * })
   *
   * events.on('test', async () => {
   *   await new Promise((resolve) => {
   *     setTimeout(() => {
   *       count += 5
   *       resolve()
   *     }, 5000)
   *   })
   * })
   *
   * events.on('test', async () => {
   *   await new Promise((resolve) => {
   *     setTimeout(() => {
   *       count++
   *       resolve()
   *     }, 1000)
   *   })
   * })
   *
   * const promise = events.emit('test')
   * console.log(count) // => 1
   *
   * setTimeout(() => {
   *   console.log(count) // => 2
   * }, 2000)
   *
   * promise.then(() => {
   *   console.log(count) // => 7
   * })
   * ```
   */
  async emit<Name extends keyof EventMap>(
    eventName: Name,
    ...eventArgs: NormalizeEventParams<EventMap[Name]>
  ): Promise<void> {
    assertEventName(eventName)

    if (isMetaEvent(eventName) && !canEmitMetaEvents) {
      throw new TypeError('`eventName` cannot be meta event `listenerAdded` or `listenerRemoved`')
    }

    this.logIfDebugEnabled('emit', eventName, eventArgs)

    enqueueProducers(this, eventName, eventArgs)

    // 这里需要进行一次浅拷贝，避免将动态注册的监听器放在本次执行栈中
    const listeners = (getListeners(this)?.get(eventName) || []).slice()
    // 如果触发的是内置的元事件则置空执行栈，避免 `onAny()` 时自动触发元事件
    const anyListeners = isMetaEvent(eventName) ? [] : (getAnyListeners(this) || []).slice()
    await Promise.all([
      ...listeners.map((fn) => fn.apply(this, eventArgs)),
      ...anyListeners.map((fn) => fn.apply(this, [eventName, ...eventArgs])),
    ])
  }

  /**
   * 触发一个事件，所有监听器串行执行
   * @param eventName 事件名称
   * @param eventArgs 事件参数列表
   *
   * @returns 返回一个 {@link Promise Promise}，当所有监听器执行完毕后 resolve
   *
   * @example
   * ```ts
   * const events = new Emitter()
   *
   * let count = 0
   *
   * events.on('test', () => {
   *   count++
   * })
   *
   * events.on('test', async () => {
   *   await new Promise((resolve) => {
   *     setTimeout(() => {
   *       count += 5
   *       resolve()
   *     }, 5000)
   *   })
   * })
   *
   * events.on('test', async () => {
   *   await new Promise((resolve) => {
   *     setTimeout(() => {
   *       count++
   *       resolve()
   *     }, 1000)
   *   })
   * })
   *
   * const promise = events.emit('test')
   * console.log(count) // => 1
   *
   * setTimeout(() => {
   *   // 不同于 `emit()`，串行执行时会按照监听器注册顺序执行
   *   console.log(count) // => 1
   * }, 2000)
   *
   * promise.then(() => {
   *   console.log(count) // => 7
   * })
   * ```
   */
  async emitSerial<Name extends keyof EventMap>(
    eventName: Name,
    ...eventArgs: NormalizeEventParams<EventMap[Name]>
  ): Promise<void> {
    assertEventName(eventName)

    if (isMetaEvent(eventName) && !canEmitMetaEvents) {
      throw new TypeError('`eventName` cannot be meta event `listenerAdded` or `listenerRemoved`')
    }

    this.logIfDebugEnabled('emitSerial', eventName, eventArgs)

    // 这里需要进行一次浅拷贝，避免将动态注册的监听器放在本次执行栈中
    const listeners = (getListeners(this)?.get(eventName) || []).slice()
    const anyListeners = (anyListenersMap.get(this) || []).slice()

    for (const listener of listeners) {
      await listener.apply(this, eventArgs)
    }

    for (const listener of anyListeners) {
      await listener.apply(this, [eventName, ...eventArgs])
    }
  }

  /**
   * 注册任意事件监听器
   * @param listener 监听器
   * @param options 注册监听器配置项
   *
   * @returns 移除事件监听器句柄
   *
   * @example
   * ```ts
   * const events = new Emitter()
   *
   * // 注册事件监听器
   * events.onAny((eventName) => {})
   *
   * // 注册事件监听器并指定执行顺序
   * events.onAny((eventName) => {}, { enforce: 'before' })
   *
   * // 注册单次事件监听器
   * events.onAny((eventName) => {}, { once: true })
   *
   * // 注册事件监听器并使用 AbortSignal 终止监听器
   * events.onAny((eventName) => {}, { signal: AbortSignal.timeout(5000) })
   * ```
   */
  onAny(
    listener: Listener<
      [eventName: keyof EventMap, ...NormalizeEventParams<EventMap[keyof EventMap]>]
    >,
    { enforce, signal, once }: OnListenerOptions = {},
  ): UnsubscribeHandle {
    assertListener(listener)

    this.logIfDebugEnabled('subscribeAny')

    if (once) {
      const rawListener = listener
      listener = function (...args) {
        offAny()
        return rawListener.apply(this, args)
      }
    }

    this._addListener(enforce, anyListenersMap.get(this) || [], listener)
    emitMetaEvent(this, listenerAdded, { listener })

    const offAny = () => {
      this.offAny(listener)
      signal?.removeEventListener('abort', offAny)
    }

    if (signal) {
      signal.addEventListener('abort', offAny, { once: true })
      signal.aborted && offAny()
    }

    return offAny
  }

  /**
   * 移除任意事件监听器
   * @param listener 监听器
   *
   * @example
   * ```ts
   * const events = new Emitter()
   *
   * const listener = (eventName) => {}
   *
   * // 移除事件监听器
   * events.offAny(listener)
   * ```
   */
  offAny(
    listener: Listener<
      [eventName: keyof EventMap, ...NormalizeEventParams<EventMap[keyof EventMap]>]
    >,
  ): void {
    assertListener(listener)

    this.logIfDebugEnabled('unsubscribeAny')

    this._removeListener(anyListenersMap.get(this) || [], listener)
    emitMetaEvent(this, listenerRemoved, { listener })
  }

  // deno-lint-ignore no-explicit-any
  private _iterator(eventNames: EventName[]): any {
    const producer = createProducer()
    for (const eventName of eventNames) {
      let set = getProducers(this)?.get(eventName)
      if (!set) {
        set = new Set()
        producersMap.get(this)?.set(eventName, set)
      }
      set.add(producer)
    }

    // deno-lint-ignore no-this-alias
    const instance = this
    return {
      [Symbol.asyncIterator]() {
        return this
      },

      async next() {
        if (!producer.queue) {
          return { done: true, value: undefined }
        }

        if (producer.queue.length === 0) {
          if (producer.isFinished) {
            producer.queue = null
            return this.next()
          }

          await new Promise<void>((resolve) => {
            producer.flush = resolve
          })

          return this.next()
        }

        return { done: false, value: await Promise.all(producer.queue.shift()!) }
      },

      async return(...args: unknown[]) {
        producer.queue = null

        for (const eventName of eventNames) {
          const set = getProducers(instance)?.get(eventName)
          if (set) {
            set.delete(producer)
            if (set.size === 0) {
              producersMap.get(instance)?.delete(eventName)
            }
          }
        }

        producer.finish()

        return { done: true, value: args.length > 0 ? await Promise.all(args) : undefined }
      },
    }
  }

  /**
   * 获取一个异步迭代器，该迭代器在每次发出事件时缓冲数据
   *
   * 在迭代器上调用 `return()` 可以清空当前缓存并不再订阅事件
   *
   * @param eventName 事件名称，支持多个事件名称
   *
   * @returns 异步迭代器
   *
   * @example
   * ```ts
   * const events = new Emitter()
   * const iterator = events.events('test')
   *
   * events.emit('test', 'hello world')
   * events.emit('test', 'hello iterator')
   * events.emit('test2', 'arg1', 'arg2', 'arg3')
   *
   * // 使用 for await...of 进行迭代
   * for await (const [eventName, ...eventArgs] of iterator) {
   *   console.log(eventName, eventArgs)
   *   // => 'test', ['hello world']
   *   // => 'test', ['hello iterator']
   * }
   *
   * events.emit('test', 'hello again')
   *
   * for await (const [eventName, ...eventArgs] of iterator) {
   *   console.log(eventName, eventArgs)
   *   // => 'test', ['hello again']
   * }
   *
   * // 取消订阅事件
   * iterator.return()
   *
   * events.emit('test', 'hello again')
   *
   * iterator.next()
   * // => { done: true, value: undefined }
   * ```
   */
  events<Name extends keyof EventMap>(
    eventName: Name | readonly Name[],
  ): AsyncIterableIterator<NormalizeEventParams<EventMap[Name]>> {
    const eventNames = castArray(eventName as EventName)
    for (const eventName of eventNames) {
      assertEventName(eventName)
    }

    return this._iterator(eventNames)
  }

  /**
   * 获取一个异步迭代器，每次发出事件时，它都会缓冲事件名称和参数列表
   *
   * 在迭代器上调用 `return()` 可以清空当前缓存并不再订阅事件
   *
   * @returns 异步迭代器
   *
   * @example
   * ```ts
   * const events = new Emitter()
   * const iterator = events.anyEvent()
   *
   * events.emit('test', 'hello world')
   * events.emit('test', 'hello iterator')
   * events.emit('test2', 'arg1', 'arg2', 'arg3')
   *
   * // 使用 for await...of 进行迭代
   * for await (const [eventName, ...eventArgs] of iterator) {
   *   console.log(eventName, eventArgs)
   *   // => 'test', ['hello world']
   *   // => 'test', ['hello iterator']
   *   // => 'test2', ['arg1', 'arg2', 'arg3']
   * }
   *
   * events.emit('test', 'hello again')
   *
   * for await (const [eventName, ...eventArgs] of iterator) {
   *   console.log(eventName, eventArgs)
   *   // => 'test', ['hello again']
   * }
   *
   * // 取消订阅事件
   * iterator.return()
   *
   * events.emit('test', 'hello again')
   *
   * iterator.next()
   * // => { done: true, value: undefined }
   */
  anyEvent(): AsyncIterableIterator<
    [eventName: keyof EventMap, ...eventArgs: NormalizeEventParams<EventMap[keyof EventMap]>]
  > {
    return this._iterator([anyProducer])
  }

  /**
   * 清除所有事件监听器，如果指定了 `eventName`，则只清除指定事件的监听器
   * @param eventName 事件名称，支持多个事件名称
   */
  clearListeners<Name extends keyof EventMap>(eventName?: Name | readonly Name[]): void {
    const eventNames = castArray(eventName as EventName)
    for (const eventName of eventNames) {
      this.logIfDebugEnabled('clear', eventName)

      if (isEventNameType(eventName)) {
        const arr = getListeners(this)?.get(eventName)
        if (arr) {
          arr.length = 0
        }

        const producers = getProducers(this)?.get(eventName)
        if (producers) {
          producers.forEach((p) => p.finish())
          producers.clear()
        }
      } else {
        listenersMap.set(this, new Map())
        anyListenersMap.set(this, [])
        producersMap.get(this)?.forEach((producers) => producers.forEach((p) => p.finish()))
        producersMap.set(this, new Map())
      }
    }
  }

  /**
   * 获取监听器数量，如果指定了 `eventName`，则只获取指定事件的监听器数量
   * @param eventName 事件名称，支持多个事件名称
   */
  listenerCount<Name extends keyof EventMap>(eventName?: Name | readonly Name[]): number {
    let count = 0

    const eventNames = castArray(eventName as EventName)
    for (const eventName of eventNames) {
      if (isEventNameType(eventName)) {
        count += (anyListenersMap.get(this)?.length || 0) +
          (getListeners(this)?.get(eventName)?.length || 0) +
          (getProducers(this)?.get(eventName)?.size || 0) +
          (getProducers(this)?.get(anyProducer)?.size || 0)

        continue
      }

      if (eventName !== undefined) {
        assertEventName(eventName)
      }

      count += anyListenersMap.get(this)?.length || 0

      listenersMap.get(this)?.forEach((listeners) => {
        count += listeners.length
      })

      producersMap.get(this)?.forEach((producers) => {
        count += producers.size
      })
    }

    return count
  }
}

/**
 * 创建事件触发器实例
 * @param options 配置项
 *
 * @returns 事件触发器
 *
 * @example
 * ```ts
 * const events = createEmitter() // => new Emitter()
 * ```
 */
export const createEmitter = <EventMap>(options: EmitterOptions = {}): Emitter<EventMap> => {
  return new Emitter<EventMap>(options)
}
