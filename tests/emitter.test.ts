import { listenersMap } from '@/maps.ts'
import { Emitter } from '@/mod.ts'
import { assert, assertEquals, assertRejects, assertThrows, fail, unreachable } from '@std/assert'
import { delay } from '@std/async'

async function plan(
  expectedAssertions: number,
  fn: (incrementAssertionCount: () => void) => void | Promise<void>,
) {
  let assertionCount = 0
  try {
    await fn(() => {
      assertionCount += 1
    })
  } finally {
    if (assertionCount !== expectedAssertions) {
      unreachable(`Expected ${expectedAssertions} assertions but got ${assertionCount}.`)
    }
  }
}

Deno.test('on()', () => {
  const emitter = new Emitter()
  const eventName = Symbol('eventName')
  const calls: unknown[] = []
  const listener1 = () => {
    calls.push(1)
  }

  const listener2 = () => {
    calls.push(2)
  }

  const listener3 = () => {
    calls.push(3)
  }

  emitter.on('🦄', listener1)
  emitter.on('🦄', listener2)
  emitter.on(eventName, listener3)
  emitter.emit('🦄')
  emitter.emit(eventName)
  assertEquals(calls, [1, 2, 3])
})

Deno.test('on() - multiple event names', () => {
  const emitter = new Emitter()
  const eventName = Symbol('eventName')
  let count = 0
  const listener = () => {
    ++count
  }

  emitter.on(['🦄', '🐶', eventName], listener)
  emitter.emit('🦄')
  emitter.emit('🐶')
  emitter.emit(eventName)
  assertEquals(count, 3)
})

Deno.test('on() - symbol eventName', () => {
  const emitter = new Emitter()
  const eventName = Symbol('eventName')
  const calls: unknown[] = []
  const listener1 = () => {
    calls.push(1)
  }

  const listener2 = () => {
    calls.push(2)
  }

  emitter.on(eventName, listener1)
  emitter.on(eventName, listener2)
  emitter.emit(eventName)
  assertEquals(calls, [1, 2])
})

Deno.test('on() - once', () => {
  const emitter = new Emitter()
  let executed = false
  emitter.on('🦄', () => {
    if (!executed) {
      executed = true
    } else {
      fail()
    }
  }, { once: true })
  emitter.emit('🦄', '🌈')
  emitter.emit('🦄', '🌈')
})

Deno.test('on() - enforce', () => {
  const emitter = new Emitter()
  const calls: unknown[] = []

  emitter.on('🦄', () => {
    calls.push(1)
  })

  emitter.on('🦄', () => {
    calls.push(2)
  }, { enforce: 'before' })

  emitter.on('🦄', () => {
    calls.push(3)
  }, { enforce: 'before' })

  emitter.on('🦄', () => {
    calls.push(4)
  })

  emitter.emit('🦄')

  assertEquals(calls, [3, 2, 1, 4])
})

Deno.test('on() - listenerAdded', () => {
  const emitter = new Emitter()
  const addListener = () => 1
  Promise.resolve().then(() => emitter.on('abc', addListener))

  emitter.on(Emitter.listenerAdded, (e) => {
    assertEquals(e.eventName, 'abc')
    assertEquals(e.listener, addListener)
  })
})

Deno.test('on() - listenerRemoved', () => {
  const emitter = new Emitter()
  const addListener = () => 1
  emitter.on('abc', addListener)
  Promise.resolve().then(() => emitter.off('abc', addListener))

  emitter.on(Emitter.listenerRemoved, (e) => {
    assertEquals(e.eventName, 'abc')
    assertEquals(e.listener, addListener)
  })
})

Deno.test('on() - listenerAdded onAny', () => {
  const emitter = new Emitter()
  const addListener = () => 1
  Promise.resolve().then(() => emitter.onAny(addListener))

  emitter.on(Emitter.listenerAdded, (e) => {
    assertEquals(e.eventName, undefined)
    assertEquals(e.listener, addListener)
  })
})

Deno.test('off() - listenerAdded', () => {
  const emitter = new Emitter()
  const off = emitter.on(Emitter.listenerAdded, () => fail())
  off()
  emitter.emit('a')
})

Deno.test('on() - listenerAdded offAny', () => {
  const emitter = new Emitter()
  const addListener = () => 1
  emitter.onAny(addListener)
  Promise.resolve().then(() => emitter.offAny(addListener))

  emitter.on(Emitter.listenerRemoved, (e) => {
    assertEquals(e.eventName, undefined)
    assertEquals(e.listener, addListener)
  })
})

Deno.test('on() - eventName must be a string, symbol, or number', () => {
  const emitter = new Emitter()

  emitter.on('string', () => {})
  emitter.on(Symbol('symbol'), () => {})
  emitter.on(42, () => {})

  assertThrows(() => {
    // @ts-expect-error 测试错误参数
    emitter.on(true, () => {})
  }, TypeError)
})

Deno.test('on() - must have a listener', () => {
  const emitter = new Emitter()

  assertThrows(() => {
    // @ts-expect-error 测试缺失参数
    emitter.on('🦄')
  }, TypeError)
})

Deno.test('on() - returns a unsubscribe method', () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  const listener = () => {
    calls.push(1)
  }

  const off = emitter.on('🦄', listener)
  emitter.emit('🦄')
  assertEquals(calls, [1])

  off()
  emitter.emit('🦄')
  assertEquals(calls, [1])
})

Deno.test('on() - dedupes identical listeners', () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  const listener = () => {
    calls.push(1)
  }

  emitter.on('🦄', listener)
  emitter.on('🦄', listener)
  emitter.on('🦄', listener)
  emitter.emit('🦄')
  assertEquals(calls, [1])
})

Deno.test('on() - use abort signal', () => {
  const emitter = new Emitter()
  const abortController = new AbortController()

  const calls: unknown[] = []
  const listener = () => {
    calls.push(1)
  }

  emitter.on('abc', listener, { signal: abortController.signal })

  emitter.emit('abc')
  assertEquals(calls, [1])

  abortController.abort()
  emitter.emit('abc')

  assertEquals(calls, [1])
})

Deno.test('events()', async () => {
  const emitter = new Emitter()
  const iterator = emitter.events('🦄')

  emitter.emit('🦄', '🌈')
  setTimeout(() => {
    emitter.emit('🦄', Promise.resolve('🌟'))
  }, 10)

  await plan(3, async (increment) => {
    const expected = ['🌈', '🌟']
    for await (const [data] of iterator) {
      assertEquals(data, expected.shift())
      increment()

      if (expected.length === 0) {
        break
      }
    }

    assertEquals(await iterator.next(), { done: true, value: undefined })
    increment()
  })
})

Deno.test('events() - multiple event names', async () => {
  const emitter = new Emitter()
  const iterator = emitter.events(['🦄', '🐶'])

  emitter.emit('🦄', '🌈')
  emitter.emit('🐶', '🌈')
  setTimeout(() => {
    emitter.emit('🦄', Promise.resolve('🌟'))
  }, 10)

  await plan(4, async (increment) => {
    const expected = ['🌈', '🌈', '🌟']
    for await (const [data] of iterator) {
      assertEquals(data, expected.shift())
      increment()

      if (expected.length === 0) {
        break
      }
    }

    assertEquals(await iterator.next(), { done: true, value: undefined })
    increment()
  })
})

Deno.test('events() - return() called during emit', async () => {
  const emitter = new Emitter()
  let iterator: AsyncIterableIterator<unknown> | null = null
  emitter.on('🦄', () => {
    iterator!.return!()
  })
  iterator = emitter.events('🦄')
  emitter.emit('🦄', '🌈')
  // 这里必须同步情况下才会相等，否则会在 iterator.return() 后被清空
  assertEquals(iterator.next(), Promise.resolve({ done: false, value: '🌈' }))
  assertEquals(await iterator.next(), { done: true, value: undefined })
})

Deno.test('events() - return() awaits its argument', async () => {
  const emitter = new Emitter()
  const iterator = emitter.events('🦄')
  assertEquals(await iterator.return!(Promise.resolve(1)), { done: true, value: [1] })
})

Deno.test('events() - return() without argument', async () => {
  const emitter = new Emitter()
  const iterator = emitter.events('🦄')
  assertEquals(await iterator.return!(), { done: true, value: undefined })
})

Deno.test('events() - discarded iterators should stop receiving events', async () => {
  const emitter = new Emitter()
  const iterator = emitter.events('🦄')

  emitter.emit('🦄', '🌈')
  assertEquals(await iterator.next(), { value: ['🌈'], done: false })
  await iterator.return!()

  emitter.emit('🦄', '🌈')
  assertEquals(await iterator.next(), { done: true, value: undefined })

  setTimeout(() => {
    emitter.emit('🦄', '🌟')
  }, 10)

  await new Promise((resolve) => {
    setTimeout(resolve, 20)
  })

  assertEquals(await iterator.next(), { done: true, value: undefined })
})

Deno.test('off()', () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  const listener = () => {
    calls.push(1)
  }

  emitter.on('🦄', listener)
  emitter.emit('🦄')
  assertEquals(calls, [1])

  emitter.off('🦄', listener)
  emitter.emit('🦄')
  assertEquals(calls, [1])
})

Deno.test('off() - multiple event names', () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  const listener = () => {
    calls.push(1)
  }

  emitter.on(['🦄', '🐶', '🦊'], listener)
  emitter.emit('🦄')
  assertEquals(calls, [1])

  emitter.off(['🦄', '🐶'], listener)
  emitter.emit('🦄')
  emitter.emit('🐶')
  assertEquals(calls, [1])

  emitter.emit('🦊')
  assertEquals(calls, [1, 1])
})

Deno.test('off() - eventName must be a string, symbol, or number', () => {
  const emitter = new Emitter()

  emitter.on('string', () => {})
  emitter.on(Symbol('symbol'), () => {})
  emitter.on(42, () => {})

  assertThrows(() => {
    // @ts-expect-error 测试错误参数
    emitter.off(true)
  }, TypeError)
})

Deno.test('off() - no listener', () => {
  const emitter = new Emitter()

  assertThrows(() => {
    // @ts-expect-error 测试缺失参数
    emitter.off('🦄')
  }, TypeError)
})

Deno.test('off() - clears global maps when all listeners are removed', () => {
  const emitter = new Emitter()

  const event = 'string'
  const callback = () => {}

  emitter.on(event, callback)
  assertEquals(listenersMap.get(emitter)?.get(event)?.length, 1)

  emitter.off(event, callback)
  assertEquals(listenersMap.get(emitter)?.get(event), undefined)
})

Deno.test('emit() - one event', () => {
  const emitter = new Emitter()
  const eventFixture = { foo: true }
  emitter.on('🦄', (value) => {
    assertEquals(value, eventFixture)
  })
  emitter.emit('🦄', eventFixture)
})

Deno.test('emit() - eventName must be a string, symbol, or number', async () => {
  const emitter = new Emitter()

  emitter.emit('string')
  emitter.emit(Symbol('symbol'))
  emitter.emit(42)

  await assertRejects(() => {
    // @ts-expect-error 测试错误参数
    return emitter.emit(true)
  }, TypeError)
})

Deno.test('emit() - userland cannot emit the meta events', async () => {
  const emitter = new Emitter()

  await assertRejects(() => emitter.emit(Emitter.listenerRemoved), Error)
  await assertRejects(() => emitter.emit(Emitter.listenerAdded), Error)
})

Deno.test('emit() - is sync', () => {
  const emitter = new Emitter()

  let unicorn = false
  emitter.on('🦄', () => {
    unicorn = true
  })

  emitter.emit('🦄')

  assert(unicorn)
})

Deno.test('emit() - awaits async listeners', async () => {
  const emitter = new Emitter()
  let unicorn = false

  emitter.on('🦄', async () => {
    await Promise.resolve()
    unicorn = true
  })

  const promise = emitter.emit('🦄')
  assertEquals(unicorn, false)
  await promise
  assert(unicorn)
})

Deno.test('emit() - calls listeners subscribed when emit() was invoked', () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  const off1 = emitter.on('🦄', () => {
    calls.push(1)
  })
  emitter.emit('🦄')
  emitter.on('🦄', () => {
    calls.push(2)
  })
  assertEquals(calls, [1])

  const off3 = emitter.on('🦄', () => {
    calls.push(3)
    off1()
    emitter.on('🦄', () => {
      calls.push(4)
    })
  })
  emitter.emit('🦄')
  assertEquals(calls, [1, 1, 2, 3])
  off3()

  const off5 = emitter.on('🦄', () => {
    calls.push(5)
    emitter.onAny(() => {
      calls.push(6)
    })
  })
  emitter.emit('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5])
  off5()

  let off8: (() => void) | null = null
  emitter.on('🦄', () => {
    calls.push(7)
    off8!()
  })
  off8 = emitter.on('🦄', () => {
    calls.push(8)
  })
  emitter.emit('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6])

  let off10: (() => void) | null = null
  emitter.onAny(() => {
    calls.push(9)
    off10!()
  })
  off10 = emitter.onAny(() => {
    calls.push(10)
  })
  emitter.emit('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6, 2, 4, 7, 6, 9, 10])

  emitter.emit('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6, 2, 4, 7, 6, 9, 10, 2, 4, 7, 6, 9])

  emitter.clearListeners()
  emitter.emit('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6, 2, 4, 7, 6, 9, 10, 2, 4, 7, 6, 9])
})

Deno.test('emit() - returns undefined', async () => {
  const emitter = new Emitter()

  emitter.on('🦄', () => '🌈')
  assertEquals(await emitter.emit('🦄'), undefined)

  emitter.on('🦄🦄', () => Promise.resolve('🌈'))
  assertEquals(await emitter.emit('🦄🦄'), undefined)
})

Deno.test('emit() - throws an error if any listener throws', async () => {
  const emitter = new Emitter()

  emitter.on('🦄', () => {
    throw new Error('🌈')
  })
  await assertRejects(() => emitter.emit('🦄'), Error)

  emitter.on('🦄🦄', () => {
    throw new Error('🌈')
  })
  await assertRejects(() => emitter.emit('🦄🦄'), Error)
})

Deno.test('emitSerial()', async () => {
  const emitter = new Emitter()

  const values: unknown[] = []
  const listener = async (value: number) => {
    await delay(Math.random() * 100)
    values.push(value)
  }

  emitter.on('🦄', () => listener(1))
  emitter.on('🦄', () => listener(2))
  emitter.on('🦄', () => listener(3))
  emitter.on('🦄', () => listener(4))
  emitter.on('🦄', () => listener(5))

  await emitter.emitSerial('🦄')

  assertEquals(values, [1, 2, 3, 4, 5])
})

Deno.test('emitSerial() - eventName must be a string, symbol, or number', async () => {
  const emitter = new Emitter()

  emitter.emitSerial('string')
  emitter.emitSerial(Symbol('symbol'))
  emitter.emitSerial(42)

  await assertRejects(() => {
    // @ts-expect-error 测试错误参数
    return emitter.emitSerial(true)
  }, TypeError)
})

Deno.test('emitSerial() - userland cannot emit the meta events', async () => {
  const emitter = new Emitter()

  await assertRejects(() => emitter.emitSerial(Emitter.listenerRemoved), TypeError)
  await assertRejects(() => emitter.emitSerial(Emitter.listenerAdded), TypeError)
})

Deno.test('emitSerial() - is sync', () => {
  const emitter = new Emitter()

  let unicorn = false
  emitter.on('🦄', () => {
    unicorn = true
  })

  emitter.emitSerial('🦄')

  assert(unicorn)
})

Deno.test('emitSerial() - calls listeners subscribed when emitSerial() was invoked', async () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  const off1 = emitter.on('🦄', () => {
    calls.push(1)
  })
  const p = emitter.emitSerial('🦄')
  emitter.on('🦄', () => {
    calls.push(2)
  })
  await p
  assertEquals(calls, [1])

  const off3 = emitter.on('🦄', () => {
    calls.push(3)
    off1()
    emitter.on('🦄', () => {
      calls.push(4)
    })
  })
  await emitter.emitSerial('🦄')
  assertEquals(calls, [1, 1, 2, 3])
  off3()

  const off5 = emitter.on('🦄', () => {
    calls.push(5)
    emitter.onAny(() => {
      calls.push(6)
    })
  })
  await emitter.emitSerial('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5])
  off5()

  let off8: (() => void) | null = null
  emitter.on('🦄', () => {
    calls.push(7)
    off8!()
  })
  off8 = emitter.on('🦄', () => {
    calls.push(8)
  })
  await emitter.emitSerial('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6])

  let off10: (() => void) | null = null
  emitter.onAny(() => {
    calls.push(9)
    off10!()
  })
  off10 = emitter.onAny(() => {
    calls.push(10)
  })
  await emitter.emitSerial('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6, 2, 4, 7, 6, 9, 10])

  await emitter.emitSerial('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6, 2, 4, 7, 6, 9, 10, 2, 4, 7, 6, 9])

  emitter.clearListeners()
  emitter.emitSerial('🦄')
  assertEquals(calls, [1, 1, 2, 3, 2, 4, 5, 2, 4, 7, 8, 6, 2, 4, 7, 6, 9, 10, 2, 4, 7, 6, 9])
})

Deno.test('onAny()', async () => {
  const emitter = new Emitter()
  const eventFixture = { foo: true }

  await plan(4, async (increment) => {
    emitter.onAny((eventName, data) => {
      assertEquals(eventName, '🦄')
      increment()
      assertEquals(data, eventFixture)
      increment()
    })

    await emitter.emit('🦄', eventFixture)
    await emitter.emitSerial('🦄', eventFixture)
  })
})

Deno.test('onAny() - must have a listener', () => {
  const emitter = new Emitter()

  assertThrows(() => {
    // @ts-expect-error 测试缺失参数
    emitter.onAny()
  }, TypeError)
})

Deno.test('onAny() - use abort signal', async () => {
  const emitter = new Emitter()
  const eventFixture = { foo: true }
  const abortController = new AbortController()

  await plan(4, async (increment) => {
    emitter.onAny((eventName, data) => {
      assertEquals(eventName, '🦄')
      increment()
      assertEquals(data, eventFixture)
      increment()
    }, { signal: abortController.signal })

    await emitter.emit('🦄', eventFixture)
    await emitter.emitSerial('🦄', eventFixture)
    abortController.abort()
    await emitter.emit('🦄', eventFixture)
  })
})

Deno.test('anyEvent()', async () => {
  const emitter = new Emitter()
  const iterator = emitter.anyEvent()

  await emitter.emit('🦄', '🌈')
  setTimeout(() => {
    emitter.emit('🦄', Promise.resolve('🌟'))
  }, 10)

  const expected = [['🦄', '🌈'], ['🦄', '🌟']]
  await plan(3, async (increment) => {
    for await (const data of iterator) {
      assertEquals(data, expected.shift() as unknown[])
      increment()

      if (expected.length === 0) {
        break
      }
    }

    assertEquals(await iterator.next(), { done: true, value: undefined })
    increment()
  })
})

Deno.test('anyEvent() - return() called during emit', async () => {
  const emitter = new Emitter()
  let iterator: AsyncIterableIterator<unknown[]> | null = null
  emitter.onAny(() => {
    iterator!.return!()
  })
  iterator = emitter.anyEvent()
  emitter.emit('🦄', '🌈')
  // 这里必须同步情况下才会相等，否则会在 iterator.return() 后被清空
  assertEquals(iterator.next(), Promise.resolve({ done: false, value: ['🦄', '🌈'] }))
  assertEquals(await iterator.next(), { done: true, value: undefined })
})

Deno.test('anyEvents() - discarded iterators should stop receiving events', async () => {
  const emitter = new Emitter()
  const iterator = emitter.anyEvent()

  await emitter.emit('🦄', '🌈')
  assertEquals(await iterator.next(), { value: ['🦄', '🌈'], done: false })
  await iterator.return!()
  await emitter.emit('🦄', '🌈')
  assertEquals(await iterator.next(), { done: true, value: undefined })

  setTimeout(() => {
    emitter.emit('🦄', '🌟')
  }, 10)

  await new Promise((resolve) => {
    setTimeout(resolve, 20)
  })

  assertEquals(await iterator.next(), { done: true, value: undefined })
})

Deno.test('offAny()', async () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  const listener = () => {
    calls.push(1)
  }

  emitter.onAny(listener)
  await emitter.emit('🦄')
  assertEquals(calls, [1])
  emitter.offAny(listener)
  await emitter.emit('🦄')
  assertEquals(calls, [1])
})

Deno.test('offAny() - no listener', () => {
  const emitter = new Emitter()

  assertThrows(() => {
    // @ts-expect-error 测试缺失参数
    emitter.offAny()
  }, TypeError)
})

Deno.test('clearListeners()', async () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  emitter.on('🦄', () => {
    calls.push('🦄1')
  })
  emitter.on('🌈', () => {
    calls.push('🌈')
  })
  emitter.on('🦄', () => {
    calls.push('🦄2')
  })
  emitter.onAny(() => {
    calls.push('any1')
  })
  emitter.onAny(() => {
    calls.push('any2')
  })
  await emitter.emit('🦄')
  await emitter.emit('🌈')
  assertEquals(calls, ['🦄1', '🦄2', 'any1', 'any2', '🌈', 'any1', 'any2'])
  emitter.clearListeners()
  await emitter.emit('🦄')
  await emitter.emit('🌈')
  assertEquals(calls, ['🦄1', '🦄2', 'any1', 'any2', '🌈', 'any1', 'any2'])
})

Deno.test('clearListeners() - also clears iterators', async () => {
  const emitter = new Emitter()
  const iterator = emitter.events('🦄')
  const anyIterator = emitter.anyEvent()
  await emitter.emit('🦄', '🌟')
  await emitter.emit('🌈', '🌟')
  assertEquals(await iterator.next(), { done: false, value: ['🌟'] })
  assertEquals(await anyIterator.next(), { done: false, value: ['🦄', '🌟'] })
  assertEquals(await anyIterator.next(), { done: false, value: ['🌈', '🌟'] })
  await emitter.emit('🦄', '💫')
  emitter.clearListeners()
  await emitter.emit('🌈', '💫')
  assertEquals(await iterator.next(), { done: false, value: ['💫'] })
  assertEquals(await iterator.next(), { done: true, value: undefined })
  assertEquals(await anyIterator.next(), { done: false, value: ['🦄', '💫'] })
  assertEquals(await anyIterator.next(), { done: true, value: undefined })
})

Deno.test('clearListeners() - with event name', async () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  emitter.on('🦄', () => {
    calls.push('🦄1')
  })
  emitter.on('🌈', () => {
    calls.push('🌈')
  })
  emitter.on('🦄', () => {
    calls.push('🦄2')
  })
  emitter.onAny(() => {
    calls.push('any1')
  })
  emitter.onAny(() => {
    calls.push('any2')
  })
  await emitter.emit('🦄')
  await emitter.emit('🌈')
  assertEquals(calls, ['🦄1', '🦄2', 'any1', 'any2', '🌈', 'any1', 'any2'])
  emitter.clearListeners('🦄')
  await emitter.emit('🦄')
  await emitter.emit('🌈')
  assertEquals(calls, [
    '🦄1',
    '🦄2',
    'any1',
    'any2',
    '🌈',
    'any1',
    'any2',
    'any1',
    'any2',
    '🌈',
    'any1',
    'any2',
  ])
})

Deno.test('clearListeners() - with multiple event names', async () => {
  const emitter = new Emitter()
  const calls: unknown[] = []
  emitter.on('🦄', () => {
    calls.push('🦄1')
  })
  emitter.on('🌈', () => {
    calls.push('🌈')
  })
  emitter.on('🦄', () => {
    calls.push('🦄2')
  })
  emitter.onAny(() => {
    calls.push('any1')
  })
  await emitter.emit('🦄')
  await emitter.emit('🌈')
  assertEquals(calls, ['🦄1', '🦄2', 'any1', '🌈', 'any1'])
  emitter.clearListeners(['🦄', '🌈'])
  await emitter.emit('🦄')
  await emitter.emit('🌈')
  assertEquals(calls, ['🦄1', '🦄2', 'any1', '🌈', 'any1', 'any1', 'any1'])
})

Deno.test('clearListeners() - with event name - clears iterators for that event', async () => {
  const emitter = new Emitter()
  const iterator = emitter.events('🦄')
  const anyIterator = emitter.anyEvent()
  await emitter.emit('🦄', '🌟')
  await emitter.emit('🌈', '🌟')
  assertEquals(await iterator.next(), { done: false, value: ['🌟'] })
  assertEquals(await anyIterator.next(), { done: false, value: ['🦄', '🌟'] })
  assertEquals(await anyIterator.next(), { done: false, value: ['🌈', '🌟'] })
  await emitter.emit('🦄', '💫')
  emitter.clearListeners('🦄')
  await emitter.emit('🌈', '💫')
  assertEquals(await iterator.next(), { done: false, value: ['💫'] })
  assertEquals(await iterator.next(), { done: true, value: undefined })
  assertEquals(await anyIterator.next(), { done: false, value: ['🦄', '💫'] })
  assertEquals(await anyIterator.next(), { done: false, value: ['🌈', '💫'] })
})

Deno.test('listenerCount()', () => {
  const emitter = new Emitter()
  emitter.on('🦄', () => {})
  emitter.on('🌈', () => {})
  emitter.on('🦄', () => {})
  emitter.onAny(() => {})
  emitter.onAny(() => {})
  assertEquals(emitter.listenerCount('🦄'), 4)
  assertEquals(emitter.listenerCount('🌈'), 3)
  assertEquals(emitter.listenerCount(), 5)
})

Deno.test('listenerCount() - multiple event names', () => {
  const emitter = new Emitter()
  emitter.on('🦄', () => {})
  emitter.on('🌈', () => {})
  emitter.on('🦄', () => {})
  emitter.onAny(() => {})
  emitter.onAny(() => {})
  assertEquals(emitter.listenerCount(['🦄', '🌈']), 7)
  assertEquals(emitter.listenerCount(), 5)
})

Deno.test('listenerCount() - works with empty eventName strings', () => {
  const emitter = new Emitter()
  emitter.on('', () => {})
  assertEquals(emitter.listenerCount(''), 1)
})

Deno.test('listenerCount() - eventName must be undefined if not a string, symbol, or number', () => {
  const emitter = new Emitter()

  emitter.listenerCount('string')
  emitter.listenerCount(Symbol('symbol'))
  emitter.listenerCount(42)
  emitter.listenerCount()

  assertThrows(() => {
    // @ts-expect-error 测试错误参数
    emitter.listenerCount(true)
  }, TypeError)
})

Deno.test('listenerCount() - symbol', () => {
  const symbol = Symbol('🦄')
  const emitter = new Emitter()
  assertEquals(emitter.listenerCount(symbol), 0)
  emitter.on(symbol, () => {})
  emitter.on(symbol, () => {})
  assertEquals(emitter.listenerCount(symbol), 2)
  emitter.onAny(() => {})
  emitter.onAny(() => {})
  assertEquals(emitter.listenerCount(symbol), 4)
})
