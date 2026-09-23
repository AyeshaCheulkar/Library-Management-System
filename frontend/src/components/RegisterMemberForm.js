import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MEMBERSHIP_TYPES } from "../../../shared/types";
import * as membersApi from "../api/members";
import Field from "./Field";
import { ErrorMessage } from "./Feedback";
import PageHeader from "./PageHeader";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ name, email }) {
  const errors = {};
  if (!name.trim()) errors.name = "A name is required.";
  else if (name.trim().length > 120) errors.name = "Names are limited to 120 characters.";

  if (!email.trim()) errors.email = "An email is required.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "That does not look like an email.";

  return errors;
}

export default function RegisterMemberForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", membershipType: "standard" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const member = await membersApi.createMember({
        name: form.name.trim(),
        email: form.email.trim(),
        membershipType: form.membershipType,
      });
      navigate(`/members/${member.id}`);
    } catch (error) {
      setErrors((previous) => ({ ...previous, ...error.fieldErrors }));
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow="Front desk"
        title="Register a member"
        lead="Enrols a borrower who has no login account yet. They can create one later with the same email and it will be linked to this record."
      />

      {submitError ? <ErrorMessage error={submitError} /> : null}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <Field
          id="member-name"
          label="Full name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
          autoComplete="name"
        />

        <Field
          id="member-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
          autoComplete="email"
        />

        <Field
          id="member-type"
          label="Membership type"
          hint="Determines how many books they may hold at once."
          error={errors.membershipType}
        >
          <select
            id="member-type"
            className="input"
            value={form.membershipType}
            onChange={(event) => update("membershipType")(event.target.value)}
          >
            {MEMBERSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Registering..." : "Register member"}
        </button>
      </form>
    </div>
  );
}
