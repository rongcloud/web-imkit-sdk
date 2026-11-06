export interface ILifecycleGuard {
  capture(): number;
  invalidate(): void;
  isCurrent(token: number): boolean;
}

export const createLifecycleGuard = (): ILifecycleGuard => {
  let version = 0;

  return {
    capture() {
      version += 1;
      return version;
    },
    invalidate() {
      version += 1;
    },
    isCurrent(token) {
      return token === version;
    },
  };
};
