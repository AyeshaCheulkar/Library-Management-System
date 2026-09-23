import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Brand from "./Brand";
import LibraryMark from "./LibraryMark";
import { Spinner } from "./Feedback";

export default function Landing() {
  const { user, status } = useAuth();

  if (status === "restoring") return <Spinner label="Restoring your session" />;
  if (user) return <Navigate to="/catalogue" replace />;

  return (
    <div className="landing">
      <header className="topbar">
        <Brand />
      </header>

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow hero__eyebrow">Library Management System</p>
          <h1 className="hero__title">
            The library,
            <br />
            <span className="hero__title-accent">accounted for.</span>
          </h1>
          <p className="hero__lead">
            Who is holding which book, what is overdue, and what is owed — worked out from
            the record every time it is asked, never stored and hoped over.
          </p>
          <div className="hero__actions">
            <Link to="/login" className="button button--large">
              Sign in
            </Link>
            <Link to="/register" className="button button--quiet button--large">
              Create an account
            </Link>
          </div>
        </div>

        <div className="hero__art">
          <LibraryMark />
        </div>
      </section>

      <footer className="landing__foot">
        <p>
          Library Management System — Advanced Web Technologies capstone. Built with
          Express, Mongoose, React and one shared TypeScript contract.
        </p>
      </footer>
    </div>
  );
}
