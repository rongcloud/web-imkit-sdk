export const calculateViewportAnchorScrollTop = (
  scrollTop: number,
  currentViewportOffset: number,
  targetViewportOffset: number,
): number => Math.max(scrollTop + currentViewportOffset - targetViewportOffset, 0);

export const getViewportOffsetForScrollAnchor = (
  scrollAnchorOffset: number,
  contentTopInset: number,
): number => contentTopInset - scrollAnchorOffset;

export interface IVirtualResizeAnchorTransaction<T> {
  id: number;
  value: T;
}

export interface IVirtualResizeAnchorController<T> {
  begin(value: T): IVirtualResizeAnchorTransaction<T>;
  cancel(): void;
  isCurrent(transaction: IVirtualResizeAnchorTransaction<T>): boolean;
  peek(): IVirtualResizeAnchorTransaction<T> | null;
  take(): IVirtualResizeAnchorTransaction<T> | null;
}

export const createVirtualResizeAnchorController = <T>(): IVirtualResizeAnchorController<T> => {
  let revision = 0;
  let pending: IVirtualResizeAnchorTransaction<T> | null = null;

  return {
    begin(value) {
      revision += 1;
      pending = { id: revision, value };
      return pending;
    },
    cancel() {
      revision += 1;
      pending = null;
    },
    isCurrent(transaction) {
      return transaction.id === revision;
    },
    peek: () => pending,
    take() {
      const transaction = pending;
      pending = null;
      return transaction;
    },
  };
};
