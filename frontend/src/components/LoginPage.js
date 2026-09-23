import { useState } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Field from "./Field";
import { ErrorMessage, Spinner } from "./Feedback";
import AuthLayout from "./AuthLayout";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login, user, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "restoring") return <Spinner label="Restoring your session" />;
  if (user) return <Navigate to={location.state?.from?.pathname ?? "/catalogue"} replace />;

  const update = (key) => (value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError(null);

    const found = {};
    if (!EMAIL_PATTERN.test(form.email.trim())) found.email = "Enter a valid email address.";
    if (!form.password) found.password = "Enter your password.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from?.pathname ?? "/catalogue", { replace: true });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in"
      lead="Use the account you already have. Members, librarians and admins all sign in here."
      footer={
        <>
          No account? <Link to="/register">Create one</Link>.
        </>
      }
    >
      {submitError ? <ErrorMessage error={submitError} /> : null}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <Field
          id="login-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
          autoComplete="username"
        />
        <Field
          id="login-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
          autoComplete="current-password"
        />
        <button type="submit" className="button button--block" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
