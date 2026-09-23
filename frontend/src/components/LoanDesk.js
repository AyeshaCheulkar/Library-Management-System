import { useCallback, useState } from "react";
import * as loansApi from "../api/loans";
import { useAsync } from "../hooks/useAsync";
import { Async } from "./Feedback";
import LoanList from "./LoanList";
import PageHeader from "./PageHeader";

const VIEWS = [
  { view: "active", label: "Out now" },
  { view: "overdue", label: "Overdue" },
  { view: "all", label: "Everything" },
];

const EMPTY = {
  active: "Nothing is out. Every book is on the shelf.",
  overdue: "Nothing is overdue.",
  all: "No loans have ever been issued.",
};

export default function LoanDesk() {
  const [view, setView] = useState("active");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => loansApi.listLoans({ view }), [view]);
  const loans = useAsync(load);

  async function runAction(loan, action, describe) {
    setNotice(null);
    setBusyId(loan.id);
    try {
      await action(loan.id);
      setNotice({ tone: "success", text: describe });
      loans.reload();
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Front desk"
        title="Loans"
        lead="What is out and who has it, most overdue first. Return a book or waive a fine without opening the borrower's record."
      />

      <div className="tabs" role="tablist" aria-label="Which loans">
        {VIEWS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            role="tab"
            aria-selected={view === tab.view}
            className={`tab${view === tab.view ? " tab--active" : ""}`}
            onClick={() => setView(tab.view)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? (
        <p className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <Async state={loans} loadingLabel="Loading loans" empty={EMPTY[view]}>
        {(page) => (
          <>
            <p className="result-count">
              {page.total} loan{page.total === 1 ? "" : "s"}
              {view === "overdue" ? " overdue" : view === "active" ? " out now" : ""}
            </p>

            <LoanList
              loans={page.items}
              showBorrower
              canManage
              busyId={busyId}
              onReturn={(loan) =>
                runAction(
                  loan,
                  loansApi.returnLoan,
                  `Returned “${loan.book ? loan.book.title : "that book"}”.`
                )
              }
              onPay={(loan) =>
                runAction(
                  loan,
                  loansApi.payFine,
                  `Fine paid for “${loan.book ? loan.book.title : "that book"}”.`
                )
              }
              onWaive={(loan) =>
                runAction(
                  loan,
                  loansApi.waiveFine,
                  `Fine waived for “${loan.book ? loan.book.title : "that book"}”.`
                )
              }
            />
          </>
        )}
      </Async>
    </div>
  );
}
