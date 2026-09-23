import { useState } from "react";

export default function BookCover({ book }) {
  const [status, setStatus] = useState(book.coverUrl ? "loading" : "failed");

  return (
    <div className={`cover cover--${status}`}>
      {status === "failed" ? (
        <div className="cover__fallback" aria-hidden="true">
          <span className="cover__fallback-title">{book.title}</span>
          <span className="cover__fallback-rule" />
          <span className="cover__fallback-author">{book.author}</span>
        </div>
      ) : (
        <img
          className="cover__img"
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("failed")}
        />
      )}
    </div>
  );
}
