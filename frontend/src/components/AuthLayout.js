import Brand from "./Brand";
import LibraryMark from "./LibraryMark";

export default function AuthLayout({ eyebrow, title, lead, children, footer }) {
  return (
    <div className="auth">
      <header className="topbar">
        <Brand />
      </header>

      <div className="auth__body">
        <div className="auth__card">
          <aside className="auth__art" aria-hidden="true">
            <LibraryMark className="mark--card" />
            <div>
              <p className="auth__art-title">One door, three roles</p>
              <p className="auth__art-text">
                Sign in as a <strong>member</strong>, a <strong>librarian</strong> or an{" "}
                <strong>admin</strong> — the same form for all three.
              </p>
            </div>
          </aside>

          <section className="auth__form-side">
            <header className="auth__head">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="auth__title">{title}</h1>
              {lead ? <p className="auth__lead">{lead}</p> : null}
            </header>

            {children}

            {footer ? <p className="auth__switch">{footer}</p> : null}
          </section>
        </div>
      </div>

      <footer className="auth__foot">
        <p>Library Management System — Advanced Web Technologies capstone.</p>
      </footer>
    </div>
  );
}
