import { useCallback, useMemo, useState } from "react";
import * as booksApi from "../api/books";
import { useAsync } from "../hooks/useAsync";
import { Async, ErrorMessage } from "./Feedback";
import Field from "./Field";
import PageHeader from "./PageHeader";

const BLANK = { isbn: "", title: "", author: "", category: "", copiesTotal: "1" };

const ISBN = /^(?:\d[- ]?){9}[\dXx]$|^(?:\d[- ]?){12}\d$/;

function validate(form) {
  const errors = {};
  if (!ISBN.test(form.isbn.trim())) errors.isbn = "Enter a valid ISBN-10 or ISBN-13.";
  if (!form.title.trim()) errors.title = "A title is required.";
  if (!form.author.trim()) errors.author = "An author is required.";
  if (!form.category.trim()) errors.category = "A category is required.";
  const copies = Number(form.copiesTotal);
  if (!Number.isInteger(copies) || copies < 0) errors.copiesTotal = "Whole number, 0 or more.";
  return errors;
}

export default function BookManager() {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => booksApi.listBooks({ pageSize: 100 }), []);
  const books = useAsync(load);

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const categories = useMemo(() => {
    const items = books.data?.items ?? [];
    return Array.from(new Set(items.map((book) => book.category))).sort();
  }, [books.data]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);
    setNotice(null);

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const created = await booksApi.createBook({
        isbn: form.isbn.trim(),
        title: form.title.trim(),
        author: form.author.trim(),
        category: form.category.trim().toLowerCase(),
        copiesTotal: Number(form.copiesTotal),
      });
      setForm(BLANK);
      setNotice({ tone: "success", text: `Added “${created.title}”.` });
      books.reload();
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(book, action, describe) {
    setNotice(null);
    setSubmitError(null);
    setBusyId(book.id);
    try {
      await action();
      setNotice({ tone: "success", text: describe });
      books.reload();
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    } finally {
      setBusyId(null);
    }
  }

  function changeCopies(book, next) {
    if (next < 0) return;
    runAction(
      book,
      () => booksApi.updateBook(book.id, { copiesTotal: next }),
      `“${book.title}” now has ${next} cop${next === 1 ? "y" : "ies"}.`
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Collection"
        title="Books"
        lead="Add a title, correct one, change how many copies the library owns, or withdraw one from lending. Withdrawing is not deleting: the book stays in the catalogue and its outstanding loans settle normally."
      />

      <section className="panel">
        <h2 className="section-head__title">Add a book</h2>

        {submitError ? <ErrorMessage error={submitError} /> : null}

        <form className="form form--split" onSubmit={handleSubmit} noValidate>
          <Field
            id="book-isbn"
            label="ISBN"
            value={form.isbn}
            onChange={update("isbn")}
            error={errors.isbn}
            hint="ISBN-10 or ISBN-13. The cover is found from this."
          />
          <Field
            id="book-title"
            label="Title"
            value={form.title}
            onChange={update("title")}
            error={errors.title}
            hint="As printed on the book."
          />
          <Field
            id="book-author"
            label="Author"
            value={form.author}
            onChange={update("author")}
            error={errors.author}
            hint="One name is enough."
          />
          <Field
            id="book-category"
            label="Category"
            value={form.category}
            onChange={update("category")}
            error={errors.category}
            hint="Reuse an existing one where you can."
            list="book-categories"
          />
          <datalist id="book-categories">
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <Field
            id="book-copies"
            label="Copies"
            type="number"
            min="0"
            value={form.copiesTotal}
            onChange={update("copiesTotal")}
            error={errors.copiesTotal}
            hint="How many the library owns."
          />
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? "Adding..." : "Add book"}
          </button>
        </form>
      </section>

      {notice ? (
        <p className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <Async state={books} loadingLabel="Loading the collection" empty="No books yet.">
        {(page) => (
          <>
            <p className="result-count">{page.total} titles</p>

            <div className="table-wrap">
              <table className="table">
                <caption className="table__caption">
                  Deleting is refused while a copy is still out — 409, and the book stays.
                  Withdraw it instead and the outstanding loans settle normally.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Book</th>
                    <th scope="col">Category</th>
                    <th scope="col">Copies</th>
                    <th scope="col">Lending</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((book, index) => (
                    <tr
                      key={book.id}
                      className={`row${book.isWithdrawn ? " row--inactive" : ""}`}
                      style={{ "--i": Math.min(index, 8) }}
                    >
                      <td data-label="Book">
                        <span className="row__title">{book.title}</span>
                        <span className="row__sub">
                          {book.author} · {book.isbn}
                        </span>
                      </td>
                      <td data-label="Category">
                        <span className="tag">{book.category}</span>
                      </td>
                      <td data-label="Copies">
                        <div className="stepper">
                          <button
                            type="button"
                            className="button button--small button--quiet"
                            aria-label={`One fewer copy of ${book.title}`}
                            disabled={busyId === book.id || book.copiesTotal === 0}
                            onClick={() => changeCopies(book, book.copiesTotal - 1)}
                          >
                            −
                          </button>
                          <span className="stepper__value">{book.copiesTotal}</span>
                          <button
                            type="button"
                            className="button button--small button--quiet"
                            aria-label={`One more copy of ${book.title}`}
                            disabled={busyId === book.id}
                            onClick={() => changeCopies(book, book.copiesTotal + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td data-label="Lending">
                        {book.isWithdrawn ? (
                          <span className="row__flag">Withdrawn</span>
                        ) : (
                          <span className="tag tag--approved">Lendable</span>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div className="row__actions">
                          <button
                            type="button"
                            className="button button--small button--quiet"
                            disabled={busyId === book.id}
                            onClick={() =>
                              runAction(
                                book,
                                () =>
                                  booksApi.updateBook(book.id, {
                                    isWithdrawn: !book.isWithdrawn,
                                  }),
                                book.isWithdrawn
                                  ? `“${book.title}” can be borrowed again.`
                                  : `“${book.title}” has been withdrawn from lending.`
                              )
                            }
                          >
                            {book.isWithdrawn ? "Restore" : "Withdraw"}
                          </button>
                          <button
                            type="button"
                            className="button button--small button--danger"
                            disabled={busyId === book.id}
                            onClick={() =>
                              runAction(
                                book,
                                () => booksApi.deleteBook(book.id),
                                `Deleted “${book.title}”.`
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Async>
    </div>
  );
}
