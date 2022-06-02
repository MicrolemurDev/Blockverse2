const memory = performance.memory;
let memUsageReadable;
if (!memory) {
  memUsageReadable = false;
} else {
  memUsageReadable = true;
}

class HardwareManager {
  #maxMem;
  #usedMem;
  #threads;
  constructor() {
    this.#threads = navigator.hardwareConcurrency;
    if (memUsageReadable) {
      this.#maxMem = memory.jsHeapSizeLimit;
      this.#usedMem = memory.usedJSHeapSize;
    } else {
      console.warn('Memory Usage could not be obtained. Some advanced debugging features are not usable.');
    }
  }

  get threads() {
    return this.#threads;
  }

  get memoryUsage() {
    if (memUsageReadable) {
      return this.#usedMem;
    } else {
      return null;
    }
  }

  get maxMemoryUsage() {
    if (memUsageReadable) {
      return this.#maxMem;
    } else {
      return null;
    }
  }
} // An API for WebUSB, WebBluetooth, and other devices

// Export
export { HardwareManager }