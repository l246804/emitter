type ProducerFlush = () => void

export class Producer {
  flush: ProducerFlush = () => {}

  queue: unknown[][] | null = []

  private _isFinished = false
  get isFinished() {
    return this._isFinished
  }

  enqueue(item: unknown[]) {
    this.queue && this.queue.push(item)
    this.flush()
  }

  finish() {
    this._isFinished = true
    this.flush()
  }
}

export const createProducer = () => new Producer()
