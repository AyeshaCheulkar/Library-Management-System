import { Link, Route, Routes, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import ProtectedRoute from "./auth/ProtectedRoute";
import { protectedRoutes, publicRoutes } from "./routes";

function NotFound() {
  return (
    <div className="page page--narrow">
      <h1 className="page__title">Page not found</h1>
      <p className="page__lead">
        Nothing lives at this address. <Link to="/catalogue">Back to the catalogue</Link>.
      </p>
    </div>
  );
}

const BARE_PATHS = new Set(publicRoutes.map((route) => route.path));

export default function App() {
  const isBare = BARE_PATHS.has(useLocation().pathname);

  return (
    <div className={isBare ? "app app--bare" : "app"}>
      {isBare ? null : <Nav />}

      <main className={isBare ? "app__main app__main--bare" : "app__main"}>
        <Routes>
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}

          {protectedRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<ProtectedRoute roles={route.roles}>{route.element}</ProtectedRoute>}
            />
          ))}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {isBare ? null : (
        <footer className="app__footer">
          <p>Library Management System — Grp1 AWT capstone</p>
        </footer>
      )}
    </div>
  );
}
