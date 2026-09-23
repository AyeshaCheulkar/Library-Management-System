import { useCallback, useState } from "react";
import * as requestsApi from "../api/requests";
import { useAsync } from "../hooks/useAsync";
import { Async } from "./Feedback";
import PageHeader from "./PageHeader";

const TABS = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "declined", label: "Declined" },
];

export default function RequestQueue() {
  const [status, setStatus] = useState("pending");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => requestsApi.listRequests({ status }), [status]);
  const requests = useAsync(load);

  async function runAction(row, action) {
    setNotice(null);
    setBusyId(row.id);
    try {
      await action();
      requests.reload();
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
        title="Requests"
        lead="What members have asked for. Approving issues the book on the spot, under the same rules as issuing at the counter."
      />

      <div className="tabs" role="tablist" aria-label="Request status">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            role="tab"
            aria-selected={status === tab.status}
            className={`tab${status === tab.status ? " tab--active" : ""}`}
            onClick={() => setStatus(tab.status)}
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

      <Async
        state={requests}
        loadingLabel="Loading requests"
        empty={
          status === "pending"
            ? "Nothing is waiting. Every request has been answered."
            : `No ${status} requests.`
        }
      >
        {(page) => (
          <>
            <p className="result-count">
              {page.total} {status} request{page.total === 1 ? "" : "s"}
            </p>

            <ul className="queue-list">
              {page.items.map((row) => (
                <li key={row.id} className="queue-list__item">
                  <div className="queue-list__body">
                    <span className="row__title">
                      {row.book ? row.book.title : "Book no longer in catalogue"}
                    </span>
                    <span className="row__sub">
                      {row.book ? row.book.author : "—"}
                    </span>
                    <span className="queue-list__meta">
                      Asked by {row.member ? row.member.name : "a former member"} on{" "}
                      {new Date(row.requestedAt).toLocaleDateString()}
                      {row.decisionNote ? ` — “${row.decisionNote}”` : ""}
                    </span>
                  </div>

                  {row.status === "pending" ? (
                    <div className="row__actions">
                      <button
                        type="button"
                        className="button button--small"
                        disabled={busyId === row.id}
                        onClick={() =>
                          runAction(row, () => requestsApi.approveRequest(row.id))
                        }
                      >
                        Approve &amp; issue
                      </button>
                      <button
                        type="button"
                        className="button button--small button--quiet"
                        disabled={busyId === row.id}
                        onClick={() =>
                          runAction(row, () =>
                            requestsApi.declineRequest(row.id, "Not available at the moment")
                          )
                        }
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className={`tag tag--${row.status}`}>{row.status}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Async>
    </div>
  );
}
