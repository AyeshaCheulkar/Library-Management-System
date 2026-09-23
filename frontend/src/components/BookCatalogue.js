import { useCallback, useMemo, useState } from "react";
import * as booksApi from "../api/books";
import * as requestsApi from "../api/requests";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { Async } from "./Feedback";
import BookCard from "./BookCard";
import PageHeader from "./PageHeader";

const PAGE_SIZE = 24;

export default function BookCatalogue() {
  const { user } = useAuth();
  const canRequest = user.role === "member";

  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);

  const query = useMemo(
    () => ({ search: submittedSearch, category, availableOnly, page, pageSize: PAGE_SIZE }),
    [submittedSearch, category, availableOnly, page]
  );

  const loadBooks = useCallback(() => booksApi.listBooks(query), [query]);
  const books = useAsync(loadBooks);

  const loadAvailability = useCallback(async () => {
    const result = await booksApi.listBooks(query);
    const entries = await Promise.all(
      result.items.map(async (book) => [book.id, await booksApi.getAvailability(book.id)])
    );
    return Object.fromEntries(entries);
  }, [query]);
  const availability = useAsync(loadAvailability);

  const loadCategories = useCallback(() => booksApi.listCategories(), []);
  const categories = useAsync(loadCategories);

  const loadMyRequests = useCallback(
    () => (canRequest ? requestsApi.listMyRequests() : Promise.resolve([])),
    [canRequest]
  );
  const myRequests = useAsync(loadMyRequests);

  const requestedByBookId = useMemo(() => {
    const open = (myRequests.data ?? []).filter((row) => row.status === "pending");
    return Object.fromEntries(open.map((row) => [row.book?.id, row.status]));
  }, [myRequests.data]);

  const reload = useCallback(() => {
    books.reload();
    availability.reload();
  }, [books, availability]);

  async function handleRequest(book) {
    setNotice(null);
    try {
      await requestsApi.requestBook(book.id);
      setNotice({
        tone: "success",
        text: `Requested “${book.title}”. A librarian will issue it to you.`,
      });
      myRequests.reload();
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    }
  }

  async function handleReserve(book) {
    setNotice(null);
    try {
      await booksApi.reserve(book.id);
      setNotice({ tone: "success", text: `You joined the queue for "${book.title}".` });
      reload();
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
    setPage(1);
  }

  function goToPage(next) {
    setPage(next);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Browse"
        title="Catalogue"
        lead="Every title we hold. Copies free is worked out from the loans on record, so it is current the moment you read it."
      />

      <form className="filters" onSubmit={handleSubmit} role="search">
        <div className="field field--grow">
          <label className="field__label" htmlFor="catalogue-search">
            Search title or author
          </label>
          <input
            id="catalogue-search"
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="e.g. Clean Code"
          />
          <p className="field__hint">Matches whole words.</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="catalogue-category">
            Category
          </label>
          <select
            id="catalogue-category"
            className="input"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((row) => (
              <option key={row.category} value={row.category}>
                {row.category} ({row.bookCount})
              </option>
            ))}
          </select>
        </div>

        <label className="checkbox field__toggle">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => {
              setAvailableOnly(event.target.checked);
              setPage(1);
            }}
          />
          Available now
        </label>

        <button type="submit" className="button">
          Search
        </button>
      </form>

      {notice ? (
        <p className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <Async
        state={books}
        loadingLabel="Loading the catalogue"
        empty={
          availableOnly
            ? "Every book matching this has all its copies out. Clear “Available now” to see them and join a queue."
            : "No books match that search."
        }
      >
        {(result) => {
          const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
          const first = (result.page - 1) * result.pageSize + 1;
          const last = Math.min(result.page * result.pageSize, result.total);

          return (
            <>
              <p className="result-count" role="status">
                Showing {first}&ndash;{last} of {result.total} book
                {result.total === 1 ? "" : "s"}
                {category ? ` in ${category}` : ""}
                {availableOnly ? " with a copy on the shelf" : ""}
              </p>

              <div className="grid">
                {result.items.map((book, index) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    index={index}
                    availability={availability.data?.[book.id]}
                    onRequest={canRequest ? handleRequest : undefined}
                    requestStatus={requestedByBookId[book.id]}
                    onReserve={handleReserve}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav className="pager" aria-label="Catalogue pages">
                  <button
                    type="button"
                    className="button button--quiet button--small"
                    onClick={() => goToPage(result.page - 1)}
                    disabled={result.page <= 1}
                  >
                    Previous
                  </button>
                  <span className="pager__status" aria-live="polite">
                    Page {result.page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="button button--quiet button--small"
                    onClick={() => goToPage(result.page + 1)}
                    disabled={result.page >= totalPages}
                  >
                    Next
                  </button>
                </nav>
              ) : null}
            </>
          );
        }}
      </Async>
    </div>
  );
}
