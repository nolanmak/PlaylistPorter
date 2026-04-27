import { EventEmitter } from 'node:events';

export class ProgressBus extends EventEmitter {
  send(event) {
    this.emit('event', event);
  }
}

export function attachSseStream(bus, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const onEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  bus.on('event', onEvent);

  res.on('close', () => {
    bus.off('event', onEvent);
  });
}
