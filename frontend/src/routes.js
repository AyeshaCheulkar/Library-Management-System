import Landing from "./components/Landing";
import BookCatalogue from "./components/BookCatalogue";
import MemberDetail from "./components/MemberDetail";
import MemberDirectory from "./components/MemberDirectory";
import MyLoans from "./components/MyLoans";
import IssueBookForm from "./components/IssueBookForm";
import RegisterMemberForm from "./components/RegisterMemberForm";
import BookManager from "./components/BookManager";
import LoanDesk from "./components/LoanDesk";
import RequestQueue from "./components/RequestQueue";
import Accounts from "./components/Accounts";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";

const EVERYONE = ["member", "librarian", "admin"];
const STAFF = ["librarian", "admin"];
const ADMIN = ["admin"];

export const publicRoutes = [
  { path: "/", element: <Landing /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
];

export const protectedRoutes = [
  { path: "/catalogue", element: <BookCatalogue />, roles: EVERYONE, navLabel: "Catalogue" },
  {
    path: "/my-loans",
    element: <MyLoans />,
    roles: EVERYONE,
    navRoles: ["member"],
    navLabel: "My loans",
  },
  { path: "/loans", element: <LoanDesk />, roles: STAFF, navLabel: "On loan" },
  { path: "/books", element: <BookManager />, roles: STAFF, navLabel: "Books" },
  { path: "/requests", element: <RequestQueue />, roles: STAFF, navLabel: "Requests" },
  { path: "/members", element: <MemberDirectory />, roles: STAFF, navLabel: "Members" },
  { path: "/issue", element: <IssueBookForm />, roles: STAFF, navLabel: "Issue" },
  {
    path: "/register-member",
    element: <RegisterMemberForm />,
    roles: STAFF,
    navLabel: "New member",
  },
  { path: "/accounts", element: <Accounts />, roles: ADMIN, navLabel: "Accounts" },
  { path: "/members/:id", element: <MemberDetail />, roles: EVERYONE },
];

export function navRoutesFor(role) {
  return protectedRoutes.filter(
    (route) => route.navLabel && (route.navRoles ?? route.roles).includes(role)
  );
}
