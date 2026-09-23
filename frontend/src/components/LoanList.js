function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Money({ amount }) {
  return <span className="money">{amount > 0 ? `₹${amount}` : "-"}</span>;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function DueStatus({ loan }) {
  if (loan.returnedAt) return null;

  if (loan.isOverdue) {
    return (
      <span className="due due--late">{plural(loan.daysOverdue, "day")} overdue</span>
    );
  }

  const soon = loan.daysUntilDue !== null && loan.daysUntilDue <= 3;
  return (
    <span className={`due${soon ? " due--soon" : ""}`}>
      in {plural(loan.daysUntilDue, "day")}
    </span>
  );
}

export default function LoanList({
  loans,
  canManage,
  onReturn,
  onPay,
  onWaive,
  busyId,
  showBorrower = false,
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="table__caption">
          Overdue rows are marked. Fines are calculated by the server.
        </caption>
        <thead>
          <tr>
            <th scope="col">Book</th>
            {showBorrower ? <th scope="col">Borrower</th> : null}
            <th scope="col">Issued</th>
            <th scope="col">Due</th>
            <th scope="col">Returned</th>
            <th scope="col">Fine</th>
            {canManage ? <th scope="col">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {loans.map((loan, index) => {
            const isOut = loan.returnedAt === null;
            return (
              <tr
                key={loan.id}
                className={loan.isOverdue ? "row row--overdue" : "row"}
                style={{ "--i": Math.min(index, 8) }}
              >
                <td data-label="Book">
                  {loan.book ? (
                    <>
                      <span className="row__title">{loan.book.title}</span>
                      <span className="row__sub">{loan.book.author}</span>
                    </>
                  ) : (
                    <span className="row__orphan">book no longer in catalogue</span>
                  )}
                </td>
                {showBorrower ? (
                  <td data-label="Borrower">{loan.member?.name ?? "-"}</td>
                ) : null}
                <td data-label="Issued">{formatDate(loan.issuedAt)}</td>
                <td data-label="Due">
                  <span className="row__title">{formatDate(loan.dueDate)}</span>
                  <DueStatus loan={loan} />
                </td>
                <td data-label="Returned">{formatDate(loan.returnedAt)}</td>
                <td data-label="Fine">
                  {isOut ? <Money amount={loan.accruedFine} /> : <Money amount={loan.fineAmount} />}
                  {loan.paidAt ? <span className="badge badge--paid">Paid</span> : null}
                  {loan.waivedAt ? <span className="badge badge--waived">Waived</span> : null}
                </td>
                {canManage ? (
                  <td data-label="Actions">
                    <div className="row__actions">
                    {isOut ? (
                      <button
                        type="button"
                        className="button button--small"
                        onClick={() => onReturn(loan)}
                        disabled={busyId === loan.id}
                      >
                        Return
                      </button>
                    ) : null}
                    {!isOut && loan.fineAmount > 0 && !loan.paidAt && !loan.waivedAt ? (
                      <>
                        {onPay ? (
                          <button
                            type="button"
                            className="button button--small"
                            onClick={() => onPay(loan)}
                            disabled={busyId === loan.id}
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {onWaive ? (
                          <button
                            type="button"
                            className="button button--small button--quiet"
                            onClick={() => onWaive(loan)}
                            disabled={busyId === loan.id}
                          >
                            Waive
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
