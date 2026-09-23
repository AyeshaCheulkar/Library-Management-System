import BookCover from "./BookCover";

export default function BookCard({
  book,
  availability,
  index = 0,
  onRequest,
  requestStatus,
  onReserve,
  onCancelReservation,
  busy,
}) {
  const available = availability?.copiesAvailable;
  const queueLength = availability?.queueLength ?? 0;
  const isOut = available === 0;
  const withdrawn = book.isWithdrawn;

  return (
    <article
      className="card"
      style={{ "--i": Math.min(index, 8) }}
    >
      <BookCover book={book} />

      <div className="card__body">
        <h3 className="card__title">{book.title}</h3>
        <p className="card__author">{book.author}</p>
        <p className="card__meta">
          <span className="tag">{book.category}</span>
          <span className="card__isbn">{book.isbn}</span>
        </p>
      </div>

      <div className="card__footer">
        {withdrawn ? (
          <span className="availability availability--out">
            <span className="availability__dot" aria-hidden="true" />
            Not for loan
          </span>
        ) : availability ? (
          <span className={`availability${isOut ? " availability--out" : ""}`}>
            <span className="availability__dot" aria-hidden="true" />
            {isOut ? "All copies out" : `${available} of ${book.copiesTotal} available`}
          </span>
        ) : (
          <span className="availability availability--pending" aria-label="Checking availability">
            <span className="skeleton skeleton--text" aria-hidden="true" />
          </span>
        )}

        {queueLength > 0 ? (
          <span className="card__queue">
            {queueLength} waiting
          </span>
        ) : null}

        {onRequest && !requestStatus && !withdrawn ? (
          <button
            type="button"
            className="button button--small"
            onClick={() => onRequest(book)}
            disabled={busy}
          >
            {isOut ? "Request anyway" : "Request"}
          </button>
        ) : null}

        {requestStatus ? (
          <span className={`tag tag--${requestStatus}`}>
            {requestStatus === "pending" ? "Requested" : requestStatus}
          </span>
        ) : null}

        {isOut && onReserve && !withdrawn ? (
          <button
            type="button"
            className="button button--small"
            onClick={() => onReserve(book)}
            disabled={busy}
          >
            Join queue
          </button>
        ) : null}

        {onCancelReservation ? (
          <button
            type="button"
            className="button button--small button--quiet"
            onClick={() => onCancelReservation(book)}
            disabled={busy}
          >
            Leave queue
          </button>
        ) : null}
      </div>
    </article>
  );
}
