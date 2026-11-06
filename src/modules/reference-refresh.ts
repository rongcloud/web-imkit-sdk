/** Bridges SDK acknowledgement and asynchronous callbacks into one bounded round. */
export const createReferenceRefreshRound = <T>(
  apply: (results: T[]) => void,
  finish: () => void,
  timeout = 30000,
) => {
  let ended = false;
  let acknowledged = false;
  let remoteResults: T[] | undefined;
  let localResults: T[] | undefined;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    finish();
  };
  const consume = (results: T[]) => {
    if (ended) return;
    try { apply(results); } catch (error) { end(); }
  };
  const settle = () => {
    if (!ended && acknowledged && remoteResults !== undefined) {
      try { consume(remoteResults); } finally { end(); }
    }
  };
  const timer = setTimeout(end, timeout);
  return {
    acknowledge(success: boolean) {
      if (ended) return;
      if (!success) { end(); return; }
      acknowledged = true;
      if (localResults?.length) consume(localResults);
      settle();
    },
    local(results: T[]) {
      // Web always supplies []; it is neither a deletion nor a terminal result.
      if (ended) return;
      localResults = Array.isArray(results) ? results : [];
      if (localResults.length && acknowledged) consume(localResults);
    },
    remote(results: T[]) {
      if (ended) return;
      remoteResults = Array.isArray(results) ? results : [];
      settle();
    },
    fail: end,
    cancel: end,
  };
};
