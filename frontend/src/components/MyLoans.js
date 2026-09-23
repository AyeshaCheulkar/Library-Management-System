import { useCallback, useState } from "react";
import * as membersApi from "../api/members";
import * as booksApi from "../api/books";
import * as requestsApi from "../api/requests";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { Async, EmptyState, ErrorMessage } from "./Feedback";
import LoanList from "./LoanList";
import PageHeader from "./PageHeader";

export default function MyLoans() {
  const { user } = useAuth();
  const [notice, setNotice] = useState(null);

  const loadLoans = useCallback(
    () => (user.memberId ? membersApi.listLoansForMember(user.memberId) : Promise.resolve([])),
    [user.memberId]
  );
  const loans = useAsync(loadLoans);

  const loadReservations = useCallback(async () => {
    if (!user.memberId) return [];
    const page = await booksApi.listBooks({ pageSize: 100 });
    return page.items.filter((book) =>
      book.reservations.some((reservation) => reservation.memberId === user.memberId)
    );
  }, [user.memberId]);
  const reservations = useAsync(loadReservations);

  const loadRequests = useCallback(
    () => (user.memberId ? requestsApi.listMyRequests() : Promise.resolve([])),
    [user.memberId]
  );
  const requests = useAsync(loadRequests);

  async function withdrawRequest(row) {
    setNotice(null);
    try {
      await requestsApi.cancelRequest(row.id);
      setNotice({
        tone: "success",
        text: `Withdrew your request for “${row.book ? row.book.title : "that book"}”.`,
      });
      requests.reload();
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    }
  }

  async function leaveQueue(book) {
    setNotice(null);
    try {
      await booksApi.cancelReservation(book.id);
      setNotice({ tone: "success", text: `You left the queue for “${book.title}”.` });
      reservations.reload();
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    }
  }

  if (!user.memberId) {
    return (
      <div className="page">
        <PageHeader eyebrow="Borrowing" title="My loans" />
        <EmptyState>
          This account has no borrower record, so it cannot hold books. Accounts created by
          signing up get one automatically.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Borrowing"
        title="My loans"
        lead="What you are holding, when it is due, and anything owed. Fines accrue by the day and stop the moment a book comes back."
      />

      {notice ? (
        <p className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <Async state={loans} loadingLabel="Loading your loans">
        {(rows) => {
          const out = rows.filter((row) => row.returnedAt === null);
          const late = out.filter((row) => row.isOverdue);
          const soon = out.filter((row) => !row.isOverdue && row.daysUntilDue <= 3);
          const owed = late.reduce((total, row) => total + row.accruedFine, 0);

          return rows.length === 0 ? (
            <EmptyState>You have not borrowed anything yet.</EmptyState>
          ) : (
            <>
              <div className="summary">
                <span className="summary__stat">
                  <strong>{out.length}</strong> out
                </span>
                {soon.length > 0 ? (
                  <span className="summary__stat summary__stat--soon">
                    <strong>{soon.length}</strong> due soon
                  </span>
                ) : null}
                {late.length > 0 ? (
                  <span className="summary__stat summary__stat--late">
                    <strong>{late.length}</strong> overdue · ₹{owed} owed
                  </span>
                ) : null}
                {late.length === 0 && soon.length === 0 && out.length > 0 ? (
                  <span className="summary__stat summary__stat--ok">Nothing due soon</span>
                ) : null}
              </div>

              <LoanList loans={rows} canManage={false} />
            </>
          );
        }}
      </Async>

      <h2 className="section-head__title">Requested</h2>
      <Async state={requests} loadingLabel="Loading your requests">
        {(rows) => {
          const open = rows.filter((row) => row.status === "pending");
          const answered = rows.filter((row) => row.status !== "pending").slice(0, 5);
          return open.length === 0 && answered.length === 0 ? (
            <EmptyState>
              You have not asked for anything. Find a book in the catalogue and press
              Request, and a librarian will issue it to you.
            </EmptyState>
          ) : (
            <ul className="queue-list">
              {[...open, ...answered].map((row) => (
                <li key={row.id} className="queue-list__item">
                  <div className="queue-list__body">
                    <span className="row__title">
                      {row.book ? row.book.title : "Book no longer in catalogue"}
                    </span>
                    <span className="row__sub">
                      asked {new Date(row.requestedAt).toLocaleDateString()}
                      {row.decisionNote ? ` — “${row.decisionNote}”` : ""}
                    </span>
                  </div>
                  {row.status === "pending" ? (
                    <button
                      type="button"
                      className="button button--small button--quiet"
                      onClick={() => withdrawRequest(row)}
                    >
                      Withdraw
                    </button>
                  ) : (
                    <span className={`tag tag--${row.status}`}>{row.status}</span>
                  )}
                </li>
              ))}
            </ul>
          );
        }}
      </Async>

      <h2 className="section-head__title">Waiting for</h2>
      <Async state={reservations} loadingLabel="Loading your reservations">
        {(books) =>
          books.length === 0 ? (
            <EmptyState>You are not in any queues.</EmptyState>
          ) : (
            <ul className="queue-list">
              {books.map((book) => (
                <li key={book.id} className="queue-list__item">
                  <div>
                    <span className="row__title">{book.title}</span>
                    <span className="row__sub">
                      position{" "}
                      {book.reservations.findIndex((r) => r.memberId === user.memberId) + 1} of{" "}
                      {book.reservations.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button--small button--quiet"
                    onClick={() => leaveQueue(book)}
                  >
                    Leave queue
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </Async>

      {loans.status === "error" ? <ErrorMessage error={loans.error} onRetry={loans.reload} /> : null}
    </div>
  );
}
