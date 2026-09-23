import { useCallback, useState } from "react";
import * as usersApi from "../api/users";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { Async } from "./Feedback";
import PageHeader from "./PageHeader";

const ROLES = ["member", "librarian", "admin"];

export default function Accounts() {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => usersApi.listAccounts(), []);
  const accounts = useAsync(load);

  async function runAction(id, action, describe) {
    setNotice(null);
    setBusyId(id);
    try {
      await action();
      setNotice({ tone: "success", text: describe });
      accounts.reload();
    } catch (error) {
      setNotice({ tone: "error", text: error.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Administration"
        title="Accounts"
        lead="Who is staff, and whose account still works. Promoting someone to librarian hands them every desk power there is, which is why it sits here and not at the desk."
      />

      {notice ? (
        <p className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <Async state={accounts} loadingLabel="Loading accounts" empty="No accounts.">
        {(page) => (
          <>
            <p className="result-count">
              {page.total} account{page.total === 1 ? "" : "s"}
            </p>

            <div className="table-wrap">
              <table className="table">
                <caption className="table__caption">
                  A role change takes effect on that person&apos;s next click — the server
                  re-reads their account on every request rather than trusting their token.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last signed in</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((account) => {
                    const isSelf = account.id === user.id;
                    return (
                      <tr
                        key={account.id}
                        className={`row${account.isActive ? "" : " row--inactive"}`}
                      >
                        <td data-label="Account">
                          <span className="row__title">
                            {account.memberName ?? account.email}
                          </span>
                          <span className="row__sub">
                            {account.memberName ? account.email : "No borrower record"}
                          </span>
                        </td>
                        <td data-label="Role">
                          <span className={`tag tag--${account.role}`}>{account.role}</span>
                        </td>
                        <td data-label="Status">
                          {account.isActive ? (
                            "Active"
                          ) : (
                            <span className="row__flag">Deactivated</span>
                          )}
                        </td>
                        <td data-label="Last signed in">
                          {account.lastLoginAt
                            ? new Date(account.lastLoginAt).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td data-label="Actions">
                          <div className="row__actions">
                          {isSelf ? (
                            <span className="row__sub">Your own account</span>
                          ) : (
                            <>
                              <label className="field__inline">
                                <span className="sr-only">
                                  Role for {account.email}
                                </span>
                                <select
                                  className="input input--compact"
                                  value={account.role}
                                  disabled={busyId === account.id}
                                  onChange={(event) =>
                                    runAction(
                                      account.id,
                                      () =>
                                        usersApi.changeRole(account.id, event.target.value),
                                      `${account.email} is now a ${event.target.value}.`
                                    )
                                  }
                                >
                                  {ROLES.map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="button button--small button--quiet"
                                disabled={busyId === account.id}
                                onClick={() =>
                                  runAction(
                                    account.id,
                                    () =>
                                      usersApi.setActive(account.id, !account.isActive),
                                    account.isActive
                                      ? `${account.email} has been deactivated.`
                                      : `${account.email} can sign in again.`
                                  )
                                }
                              >
                                {account.isActive ? "Deactivate" : "Reactivate"}
                              </button>
                            </>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Async>
    </div>
  );
}
