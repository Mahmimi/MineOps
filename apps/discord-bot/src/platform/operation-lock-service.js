export class OperationLockService {
  constructor({ stateStore, timeoutMs = 600000 }) {
    this.stateStore = stateStore;
    this.timeoutMs = timeoutMs;
  }

  current() {
    const lock = this.stateStore.getOperationLock();
    if (!lock) return null;
    const expiresAt = new Date(lock.expiresAt ?? 0).getTime();
    if (expiresAt > Date.now()) return lock;
    this.stateStore.clearOperationLock();
    return null;
  }

  acquire({ type, owner }) {
    const existing = this.current();
    if (existing) {
      const error = new Error(`${existing.type} currently in progress`);
      error.code = 'MINEOPS_OPERATION_BLOCKED';
      error.lock = existing;
      throw error;
    }

    const lock = {
      type,
      owner: owner ?? 'mineops',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.timeoutMs).toISOString(),
    };
    this.stateStore.setOperationLock(lock);
    return lock;
  }

  release(type) {
    const existing = this.current();
    if (!existing) return;
    if (!type || existing.type === type) this.stateStore.clearOperationLock();
  }
}
