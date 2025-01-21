import { DebugImpl, Emitter } from '@/mod.ts'
import { assert, assertEquals } from '@std/assert'

Deno.test('off() - isDebug logs output', () => {
  const eventStore: Record<string, unknown>[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  const off = events.on('test', () => {})
  off()
  assert(eventStore.length > 0)
  assertEquals(eventStore[2].type, 'unsubscribe')
  assertEquals(eventStore[2].eventName, 'test')
})

Deno.test('on() - isDebug logs output', () => {
  const eventStore: Record<string, unknown>[] = []
  const calls: unknown[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  events.on('test', (data) => calls.push(data))
  assert(eventStore.length > 0)
  assertEquals(eventStore[0].type, 'subscribe')
  assertEquals(eventStore[0].eventName, 'test')
})

Deno.test('emit() - isDebug logs output', async () => {
  const eventStore: Record<string, unknown>[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  events.on('test', () => {})
  await events.emit('test', 'data')
  assert(eventStore.length > 0)
  assertEquals(eventStore[2].type, 'emit')
  assertEquals(eventStore[2].eventName, 'test')
  assertEquals(eventStore[2].eventArgs, ['data'])
})

Deno.test('emitSerial() - isDebug logs output', async () => {
  const eventStore: Record<string, unknown>[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  events.on('test', () => {})
  await events.emitSerial('test', 'data')
  assert(eventStore.length > 0)
  assertEquals(eventStore[2].type, 'emitSerial')
  assertEquals(eventStore[2].eventName, 'test')
  assertEquals(eventStore[2].eventArgs, ['data'])
})

Deno.test('clearListeners() - isDebug logs output', () => {
  const eventStore: Record<string, unknown>[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  events.on('test', () => {})
  events.clearListeners('test')
  assert(eventStore.length > 0)
  assertEquals(eventStore[2].type, 'clear')
  assertEquals(eventStore[2].eventName, 'test')
})

Deno.test('onAny() - isDebug logs output', () => {
  const eventStore: Record<string, unknown>[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  events.onAny(() => {})
  assert(eventStore.length > 0)
  assertEquals(eventStore[0].type, 'subscribeAny')
  assertEquals(eventStore[0].eventName, undefined)
})

Deno.test('offAny() - isDebug logs output', () => {
  const eventStore: Record<string, unknown>[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  const off = events.onAny(() => {})
  off()
  assert(eventStore.length > 0)
  assertEquals(eventStore[2].type, 'unsubscribeAny')
  assertEquals(eventStore[2].eventName, undefined)
})

Deno.test('isDebug default logger handles symbol event names and object for event data', async () => {
  const events = new Emitter({ debug: new DebugImpl({ enabled: true }) })
  const eventName = Symbol('test')
  events.on(eventName, () => {})
  await events.emit(eventName, { complex: ['data', 'structure', 1] })
})

Deno.test('isDebug can be turned on for instance', () => {
  const eventStore: Record<string, unknown>[] = []

  const events = new Emitter({
    debug: {
      enabled: true,
      logger(type, eventName, eventArgs) {
        eventStore.push({ type, eventName, eventArgs })
      },
    },
  })

  events.on('test', () => {})
  events.emit('test', 'test data')
  events.debug!.enabled = false
  assert(eventStore.length > 0)
  assertEquals(eventStore[2].type, 'emit')
  assertEquals(eventStore[2].eventName, 'test')
  assertEquals(eventStore[2].eventArgs, ['test data'])
})

Deno.test('debug mode - handles circular references in event data', async () => {
  const events = new Emitter({
    debug: new DebugImpl({ enabled: true }),
  })

  const data: Record<string, unknown> = {}
  data.circular = data

  await events.emit('test', data)
})
