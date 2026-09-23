import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { navRoutesFor } from "../routes";
import Brand from "./Brand";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="masthead">
      <div className="masthead__inner">
        <Brand to="/catalogue" />

        {user ? (
          <>
            <nav className="nav" aria-label="Main">
              {navRoutesFor(user.role).map((route) => (
                <NavLink
                  key={route.path}
                  to={route.path}
                  end={route.path === "/catalogue"}
                  className={({ isActive }) => `nav__link${isActive ? " nav__link--active" : ""}`}
                >
                  {route.navLabel}
                </NavLink>
              ))}
            </nav>

            <div className="masthead__account">
              <span className="masthead__user">
                {user.email}
                <span className="tag tag--role">{user.role}</span>
              </span>
              <button type="button" className="button button--small button--quiet" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
