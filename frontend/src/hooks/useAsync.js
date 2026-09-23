import { useCallback, useEffect, useRef, useState } from "react";

export function useAsync(task) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  const runId = useRef(0);

  const run = useCallback(async () => {
    const id = (runId.current += 1);
    setState((previous) => ({ ...previous, status: "loading", error: null }));

    try {
      const data = await task();
      if (runId.current === id) setState({ status: "success", data, error: null });
    } catch (error) {
      if (runId.current === id) setState({ status: "error", data: null, error });
    }
  }, [task]);

  useEffect(() => {
    run();
    return () => {
      runId.current += 1;
    };
  }, [run]);

  return { ...state, reload: run };
}
