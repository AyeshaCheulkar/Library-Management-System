import { useCallback, useState } from "react";
import * as booksApi from "../api/books";
import * as membersApi from "../api/members";
import * as loansApi from "../api/loans";
import { useAsync } from "../hooks/useAsync";
import { Async, ErrorMessage } from "./Feedback";
import Field from "./Field";
import PageHeader from "./PageHeader";

function explain(error) {
  if (error.status === 422) return "That member is already holding as many books as their membership allows.";
  if (error.status === 409) return error.message;
  if (error.status === 404) return "That book or member no longer exists. Reload and try again.";
  return error.message;
}

export default function IssueBookForm() {
  const [bookId, setBookId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBooks = useCallback(() => booksApi.listBooks({ pageSize: 100 }), []);
  const books = useAsync(loadBooks);

  const loadMembers = useCallback(() => membersApi.listMembers({ pageSize: 100 }), []);
  const members = useAsync(loadMembers);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    setResult(null);

    const found = {};
    if (!bookId) found.bookId = "Choose a book.";
    if (!memberId) found.memberId = "Choose a member.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const loan = await loansApi.issueLoan(bookId, memberId);
      const title = books.data?.items.find((book) => book.id === bookId)?.title ?? "The book";
      setResult({ loan, title });
      setBookId("");
      setMemberId("");
    } catch (error) {
      setSubmitError({ ...error, message: explain(error), requestId: error.requestId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow="Front desk"
        title="Issue a book"
        lead="The due date is set by the server, one loan period from now."
      />

      {result ? (
        <p className="notice notice--success" role="status">
          Issued “{result.title}”. Due{" "}
          {new Date(result.loan.dueDate).toLocaleDateString()}.
        </p>
      ) : null}

      {submitError ? <ErrorMessage error={submitError} /> : null}

      <Async state={books} loadingLabel="Loading the catalogue">
        {(bookPage) => (
          <Async state={members} loadingLabel="Loading members">
            {(memberPage) => (
              <form className="form" onSubmit={handleSubmit} noValidate>
                <Field id="issue-book" label="Book" error={errors.bookId}>
                  <select
                    id="issue-book"
                    className={`input${errors.bookId ? " input--invalid" : ""}`}
                    value={bookId}
                    onChange={(event) => {
                      setBookId(event.target.value);
                      setErrors((previous) => ({ ...previous, bookId: undefined }));
                    }}
                  >
                    <option value="">Choose a book...</option>
                    {bookPage.items.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title} — {book.author}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="issue-member" label="Member" error={errors.memberId}>
                  <select
                    id="issue-member"
                    className={`input${errors.memberId ? " input--invalid" : ""}`}
                    value={memberId}
                    onChange={(event) => {
                      setMemberId(event.target.value);
                      setErrors((previous) => ({ ...previous, memberId: undefined }));
                    }}
                  >
                    <option value="">Choose a member...</option>
                    {memberPage.items.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.membershipType})
                      </option>
                    ))}
                  </select>
                </Field>

                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? "Issuing..." : "Issue book"}
                </button>
              </form>
            )}
          </Async>
        )}
      </Async>
    </div>
  );
}
