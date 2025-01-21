import type { EventName } from '@/mod.ts'

/**
 * 操作类型
 */
export type ActionType =
  | 'subscribe'
  | 'unsubscribe'
  | 'subscribeAny'
  | 'unsubscribeAny'
  | 'emit'
  | 'emitSerial'
  | 'clear'

/**
 * 调试模块接口
 * @example
 * ```ts
 * const CustomDebug: Debug = {
 *   enabled: true,
 *   logger(type, eventName, eventArgs) {
 *     // ...
 *   }
 * }
 * ```
 */
export interface Debug {
  /**
   * 是否启用调试模式，设为 `false` 后将不会输出调试信息
   * @example
   * ```ts
   * const events = new Emitter({
   *   // 默认开启调试模式
   *   debug: new DebugImpl({ enabled: true })
   * })
   *
   * events.on('test', () => {})
   * // 👇输出调试信息
   * // [HH:mm:ss.ms][emitter:subscribe]: test
   *
   * // 关闭调试模式
   * events.debug.enabled = false
   * events.emit('test')
   * // 不会输出调试信息
   * ```
   */
  enabled: boolean
  /**
   * 输出调试信息
   * @param type 操作类型
   * @param eventName 事件名称，部分操作类型不会有事件名称
   * @param eventArgs 事件参数列表，部分操作类型不会有事件参数
   */
  logger: (type: ActionType, eventName?: EventName, eventArgs?: unknown[]) => void
}

export interface DebugImplOptions {
  /**
   * 启用调试模式
   * @default true
   */
  enabled?: boolean
  /**
   * 日志过滤器，返回真值继续输出日志，返回假值阻止输出日志
   * @param args {@link Debug.logger Debug.logger} 的参数列表
   *
   * @returns 过滤结果
   *
   * @example
   * ```ts
   * const events = new Emitter({
   *   debug: new DebugImpl({
   *     // 只输出操作类型为 `emit` 的日志
   *     logFilter: (type) => ActionType.emit === type
   *   })
   * })
   * ```
   */
  logFilter?: (...args: Parameters<Debug['logger']>) => boolean
}

/**
 * 内置的调试模块实现
 * @example
 * ```ts
 * const events = new Emitter({ debug: new DebugImpl() })
 * ```
 */
export class DebugImpl implements Debug {
  constructor(private _options: DebugImplOptions) {
    const { enabled = true } = _options
    this.enabled = enabled
  }

  enabled: boolean

  private get _logFilter() {
    return this._options.logFilter || (() => true)
  }

  logger(type: ActionType, eventName?: EventName, eventArgs?: unknown[]): void {
    if (!this._logFilter(type, eventName, eventArgs)) {
      return
    }

    const t = new Date()
    const logTime = `${t.getHours()}:${t.getMinutes()}:${t.getSeconds()}.${t.getMilliseconds()}`

    const groupName = `[${logTime}][emitter:${type}]: ${String(eventName)}`
    console.group(groupName)
    eventArgs?.forEach((arg, i) => {
      try {
        console.log(`Arg[${i}]:`, structuredClone(arg))
      } catch (e: unknown) {
        console.error(
          `%cArg[5]: ${(e as DOMException).message}`,
          'padding-bottom: 0.5em',
          '\n\t',
          'Original Reference:',
          arg,
        )
      }
    })
    console.groupEnd()
  }
}
