import { User, type UserDocument } from "../models/user.model";
import { Member } from "../models/member.model";
import { NotFoundError, UnprocessableError } from "../errors/AppError";
import type { Paginated, Role, UserAccountDto } from "../../../shared/types";

function toAccountDto(
  user: UserDocument,
  member: { _id: { toString(): string }; name: string } | null
): UserAccountDto {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    memberId: member ? member._id.toString() : null,
    memberName: member ? member.name : null,
  };
}

export async function listAccounts(page: number, pageSize: number): Promise<Paginated<UserAccountDto>> {
  const skip = (page - 1) * pageSize;

  const [users, total] = await Promise.all([
    User.find().sort({ email: 1 }).skip(skip).limit(pageSize),
    User.countDocuments(),
  ]);

  const members = await Member.find({ user: { $in: users.map((user) => user._id) } })
    .select("_id name user")
    .lean();

  const byUser = new Map(members.map((member) => [String(member.user), member]));

  return {
    items: users.map((user) => toAccountDto(user, byUser.get(user._id.toString()) ?? null)),
    total,
    page,
    pageSize,
  };
}

async function findUserOrFail(id: string): Promise<UserDocument> {
  const user = await User.findById(id);
  if (!user) throw new NotFoundError("No such account");
  return user;
}

async function memberFor(user: UserDocument) {
  return Member.findOne({ user: user._id }).select("_id name").lean();
}

function refuseSelf(actorUserId: string, targetUserId: string): void {
  if (actorUserId === targetUserId) {
    throw new UnprocessableError(
      "You cannot change your own account. Ask another admin to do it."
    );
  }
}

export async function changeRole(
  targetUserId: string,
  role: Role,
  actorUserId: string
): Promise<UserAccountDto> {
  refuseSelf(actorUserId, targetUserId);

  const user = await findUserOrFail(targetUserId);
  user.role = role;
  await user.save();

  return toAccountDto(user, await memberFor(user));
}

export async function setActive(
  targetUserId: string,
  isActive: boolean,
  actorUserId: string
): Promise<UserAccountDto> {
  refuseSelf(actorUserId, targetUserId);

  const user = await findUserOrFail(targetUserId);
  user.isActive = isActive;
  await user.save();

  return toAccountDto(user, await memberFor(user));
}
