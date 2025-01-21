import { Emitter } from '@/mod.ts'

const emitter = new Emitter()

const listener = () => {}

Deno.bench('Emitter.on', () => {
  emitter.on('test', listener)
})

Deno.bench('Emitter.emit', { group: 'emit', baseline: true }, async () => {
  await emitter.emit('test')
})

Deno.bench('Emitter.emitSerial', { group: 'emit' }, async () => {
  await emitter.emitSerial('test')
})

Deno.bench('Emitter.clearListeners', () => {
  emitter.clearListeners('test')
})
