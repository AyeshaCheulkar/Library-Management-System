import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Spinner } from "../components/Feedback";

export default function ProtectedRoute({ roles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "restoring") return <Spinner label="Restoring your session" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page">
        <h1 className="page__title">Not permitted</h1>
        <p className="page__lead">
          Your role ({user.role}) does not have access to this page.
        </p>
      </div>
    );
  }

  return children;
}
