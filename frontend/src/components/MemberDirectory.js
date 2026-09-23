import { useCallback } from "react";
import { Link } from "react-router-dom";
import * as membersApi from "../api/members";
import { useAsync } from "../hooks/useAsync";
import { Async } from "./Feedback";
import PageHeader from "./PageHeader";

export default function MemberDirectory() {
  const loadMembers = useCallback(() => membersApi.listMembers({ pageSize: 100 }), []);
  const members = useAsync(loadMembers);

  return (
    <div className="page">
      <PageHeader eyebrow="Staff" title="Members" />

      <Async state={members} loadingLabel="Loading members">
        {(page) => (
          <>
            <p className="page__lead">{page.total} registered</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Membership</th>
                    <th scope="col">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((member) => (
                    <tr key={member.id} className="row">
                      <td data-label="Name">
                        <Link to={`/members/${member.id}`}>{member.name}</Link>
                      </td>
                      <td data-label="Email">{member.email}</td>
                      <td data-label="Membership">
                        <span className="tag">{member.membershipType}</span>
                      </td>
                      <td data-label="Account">
                        {member.userId ? "linked" : "walk-in"}
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
