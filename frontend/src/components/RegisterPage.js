import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { MIN_PASSWORD_LENGTH } from "../../../shared/types";
import { useAuth } from "../auth/AuthContext";
import Field from "./Field";
import { ErrorMessage, Spinner } from "./Feedback";
import AuthLayout from "./AuthLayout";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { register, user, status } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "restoring") return <Spinner label="Restoring your session" />;
  if (user) return <Navigate to="/catalogue" replace />;

  const update = (key) => (value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const found = {};
    if (!form.name.trim()) found.name = "A name is required.";
    if (!EMAIL_PATTERN.test(form.email.trim())) found.email = "Enter a valid email address.";
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      found.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (form.confirm !== form.password) found.confirm = "The two passwords do not match.";

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate("/catalogue", { replace: true });
    } catch (error) {
      setErrors((previous) => ({ ...previous, ...error.fieldErrors }));
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="New here"
      title="Create an account"
      lead="Signing up creates your login and your borrower record together, so you can ask for a book straight away. Already registered at the desk? Use that same email and the two records link themselves."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>.
        </>
      }
    >
      {submitError ? <ErrorMessage error={submitError} /> : null}

      <form className="form form--split" onSubmit={handleSubmit} noValidate>
        <Field
          id="register-name"
          label="Full name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
          autoComplete="name"
        />
        <Field
          id="register-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
          autoComplete="email"
        />
        <Field
          id="register-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          autoComplete="new-password"
        />
        <Field
          id="register-confirm"
          label="Confirm password"
          type="password"
          value={form.confirm}
          onChange={update("confirm")}
          error={errors.confirm}
          hint="Must match the password above."
          autoComplete="new-password"
        />
        <button type="submit" className="button button--block" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
