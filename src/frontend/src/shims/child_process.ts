// Minimal browser shim for Node's child_process module used by some
// libraries when they detect a Node-like environment. We provide a
// no-op implementation that throws if actual process creation is
// attempted at runtime in the browser.

export function spawn(): never {
  throw new Error('child_process.spawn is not available in the browser');
}

export function exec(): never {
  throw new Error('child_process.exec is not available in the browser');
}

export default { spawn, exec };
