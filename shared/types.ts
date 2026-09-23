export type Role = "member" | "librarian" | "admin";
export const ROLES: readonly Role[] = ["member", "librarian", "admin"] as const;

export type MembershipType = "standard" | "premium" | "faculty";
export const MEMBERSHIP_TYPES: readonly MembershipType[] = ["standard", "premium", "faculty"] as const;

export const BORROW_LIMITS: Record<MembershipType, number> = {
  standard: 3,
  premium: 6,
  faculty: 10,
};

export const LOAN_PERIOD_DAYS = 14;

export const FINE_PER_DAY = 5;

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  memberId: string | null;
}

export interface MemberDto {
  id: string;
  name: string;
  email: string;
  membershipType: MembershipType;
  joinedAt: string;
  userId: string | null;
}

export interface ReservationDto {
  memberId: string;
  reservedAt: string;
}

export interface BookDto {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  copiesTotal: number;
  coverUrl: string | null;
  isWithdrawn: boolean;
  reservations: ReservationDto[];
}

export interface CategoryDto {
  category: string;
  bookCount: number;
  copiesTotal: number;
}

export interface BookAvailabilityDto {
  bookId: string;
  copiesTotal: number;
  copiesAvailable: number;
  activeLoans: number;
  queueLength: number;
}

export interface LoanDto {
  id: string;
  bookId: string;
  memberId: string;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  fineAmount: number;
  accruedFine: number;
  isOverdue: boolean;
  daysUntilDue: number | null;
  daysOverdue: number;
  waivedAt: string | null;
  paidAt: string | null;
}

export interface LoanSummaryDto extends Omit<LoanDto, "bookId" | "memberId"> {
  book: Pick<BookDto, "id" | "title" | "author" | "isbn"> | null;
  member: Pick<MemberDto, "id" | "name"> | null;
}

export const REQUEST_STATUSES = ["pending", "approved", "declined", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface BookRequestDto {
  id: string;
  status: RequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  book: Pick<BookDto, "id" | "title" | "author" | "isbn"> | null;
  member: Pick<MemberDto, "id" | "name"> | null;
  loanId: string | null;
}

export interface CreateRequestBody {
  bookId: string;
}

export interface DeclineRequestBody {
  note?: string;
}

export interface RequestListQuery {
  page: number;
  pageSize: number;
  status?: RequestStatus;
}

export interface UserAccountDto {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  memberId: string | null;
  memberName: string | null;
}

export interface UpdateUserRoleBody {
  role: Role;
}

export interface UpdateUserActiveBody {
  isActive: boolean;
}

export interface ApiResponse<TData> {
  data: TData;
}

export interface Paginated<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
}

export const MIN_PASSWORD_LENGTH = 8;

export interface IssueLoanBody {
  bookId: string;
  memberId: string;
}

export interface CreateBookBody {
  isbn: string;
  title: string;
  author: string;
  category: string;
  copiesTotal?: number;
  coverUrl?: string;
}

export type UpdateBookBody = Partial<Omit<CreateBookBody, "isbn">> & {
  isWithdrawn?: boolean;
};

export interface CreateMemberBody {
  name: string;
  email: string;
  membershipType?: MembershipType;
}

export type UpdateMemberBody = Partial<CreateMemberBody>;

export const LOAN_VIEWS = ["active", "overdue", "all"] as const;
export type LoanView = (typeof LOAN_VIEWS)[number];

export interface LoanListQuery {
  page: number;
  pageSize: number;
  view: LoanView;
}

export interface BookListQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  availableOnly?: boolean;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type DeletePolicy = "block" | "cascade" | "nullify";
export const DELETE_POLICIES: readonly DeletePolicy[] = ["block", "cascade", "nullify"] as const;
export const DEFAULT_DELETE_POLICY: DeletePolicy = "block";
