export function Spinner({ label = "Loading" }) {
  return (
    <div className="feedback" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="feedback__text">{label}...</span>
    </div>
  );
}

export function ErrorMessage({ error, onRetry }) {
  const isForbidden = error?.status === 403;

  return (
    <div className={`feedback feedback--error${isForbidden ? " feedback--forbidden" : ""}`} role="alert">
      <p className="feedback__text">{error?.message ?? "Something went wrong."}</p>
      {error?.requestId ? (
        <p className="feedback__meta">
          Reference: <code>{error.requestId}</code>
        </p>
      ) : null}
      {onRetry && !isForbidden ? (
        <button type="button" className="button button--quiet" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ children }) {
  return <p className="feedback feedback--empty">{children}</p>;
}

function hasNoResults(data) {
  if (Array.isArray(data)) return data.length === 0;
  if (data && Array.isArray(data.items)) return data.items.length === 0;
  return false;
}

export function Async({ state, children, loadingLabel, empty }) {
  if (state.status === "loading") return <Spinner label={loadingLabel} />;
  if (state.status === "error") return <ErrorMessage error={state.error} onRetry={state.reload} />;
  if (empty && hasNoResults(state.data)) return <EmptyState>{empty}</EmptyState>;
  return children(state.data);
}
