import type { Emitter } from '@/mod.ts'

// deno-lint-ignore no-explicit-any
type Instance = Emitter<any>

// deno-lint-ignore no-explicit-any
export type Listener<Args extends unknown[] = any[]> = (
  this: Instance,
  ...args: Args
  // deno-lint-ignore no-explicit-any
) => void | Promise<void> | any

export type NormalizeEventParams<T> = T extends unknown[] ? T
  : [T] extends [void | undefined] ? []
  : [T]
