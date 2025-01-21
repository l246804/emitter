# emitter

一款可以运行在 Node.js、Deno.js 和浏览器中的轻量级、现代化事件触发器。

## Emitter

Emitter 是一个事件触发器的具体实现类，它提供类似于事件总线功能的核心实现。开发者可以通过 `new Emitter()` 或 `createEmitter()` 来获取 Emitter 的实例对象。此外，Emitter 类具有良好的可扩展性，可以作为基类被其他类继承，以便根据不同的应用场景和业务需求，灵活地扩展其功能，从而更好地满足多样化的事件处理需求。

### 基础用法

```ts
import { Emitter } from '@jslib/emitter'

const events = new Emitter()

events.on('test', () => {})

events.on('test', () => {}, { once: true })

events.on('test', () => {}, { enforce: 'before' })

events.emit('test')

events.clearListeners('test')
```

### 类型感知

```ts
import { Emitter } from '@jslib/emitter'

interface EventMap {
  // 事件名称: 事件参数列表
  test: [str: string]

  // 事件没有参数时可以设为 `[]`、`void` 或 `undefined`
  test2: void
}

const events = new Emitter<EventMap>()

events.on('test', (str) => {
  // 可以感知到 str 是 string
  str.trim()
})

// 感知到事件必须传入一个 string 类型参数
events.emit('test', 'string')
```

## 调试输出日志

为了减少应用构建物的体积大小，调试模块是通过 `debug` 配置项进行加载，为确保调试模块能够在 Emitter 内部正常执行，所有调试模块都应实现 `Debug` 接口定义的功能和方法。

### 内置调试模块

```ts
import { Emitter, DebugImpl } from '@jslib/emitter'

const events = new Emitter({
  // DebugImpl: 内置的调试模块实现类
  debug: new DebugImpl()
})

events.on('test', () => {})

events.emit('test')

// 关闭调试模块
events.debug.enabled = false
```

### 自定义调试模块

```ts
import { Emitter, type Debug } from '@jslib/emitter'

// 自定义调试模块的具体实现
const myDebug: Debug = {
  enabled: true,
  logger(type, eventName, eventArgs) {
    // ...
  }
}

const events = new Emitter({
  debug: myDebug
})
```
