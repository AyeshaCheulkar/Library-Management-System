import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import * as membersApi from "../api/members";
import * as loansApi from "../api/loans";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { Async, EmptyState, ErrorMessage } from "./Feedback";
import LoanList from "./LoanList";
import PageHeader from "./PageHeader";

export default function MemberDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [activeOnly, setActiveOnly] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const canManage = user.role === "librarian" || user.role === "admin";

  const loadMember = useCallback(() => membersApi.getMember(id), [id]);
  const member = useAsync(loadMember);

  const loadLoans = useCallback(
    () => membersApi.listLoansForMember(id, activeOnly),
    [id, activeOnly]
  );
  const loans = useAsync(loadLoans);

  async function runAction(loan, action) {
    setActionError(null);
    setBusyId(loan.id);
    try {
      await action(loan.id);
      loans.reload();
      member.reload();
    } catch (error) {
      setActionError(error);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <Async state={member} loadingLabel="Loading member">
        {(data) => (
          <>
            <PageHeader eyebrow="Member record" title={data.name} />
            <dl className="detail">
              <div className="detail__row">
                <dt>Email</dt>
                <dd>{data.email}</dd>
              </div>
              <div className="detail__row">
                <dt>Membership</dt>
                <dd>
                  <span className="tag">{data.membershipType}</span>
                </dd>
              </div>
              <div className="detail__row">
                <dt>Joined</dt>
                <dd>{new Date(data.joinedAt).toLocaleDateString()}</dd>
              </div>
              <div className="detail__row">
                <dt>Login account</dt>
                <dd>{data.userId ? "linked" : "walk-in (no login yet)"}</dd>
              </div>
            </dl>
          </>
        )}
      </Async>

      <div className="section-head">
        <h2 className="section-head__title">Loans</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(event) => setActiveOnly(event.target.checked)}
          />
          Currently held only
        </label>
      </div>

      {actionError ? <ErrorMessage error={actionError} /> : null}

      <Async state={loans} loadingLabel="Loading loans">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState>
              {activeOnly ? "Nothing currently on loan." : "This member has never borrowed."}
            </EmptyState>
          ) : (
            <LoanList
              loans={rows}
              canManage={canManage}
              busyId={busyId}
              onReturn={(loan) => runAction(loan, loansApi.returnLoan)}
              onPay={(loan) => runAction(loan, loansApi.payFine)}
              onWaive={(loan) => runAction(loan, loansApi.waiveFine)}
            />
          )
        }
      </Async>
    </div>
  );
}
