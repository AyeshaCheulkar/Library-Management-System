import { Link } from "react-router-dom";

export default function Brand({ to = "/" }) {
  return (
    <Link to={to} className="brand">
      Library
    </Link>
  );
}
