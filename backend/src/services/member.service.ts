import { Member, type MemberDocument } from "../models/member.model";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { applyDeletePolicy } from "./dependents.service";
import type {
  CreateMemberBody,
  DeletePolicy,
  MemberDto,
  Paginated,
  UpdateMemberBody,
} from "../../../shared/types";

export function toMemberDto(member: MemberDocument): MemberDto {
  return {
    id: member._id.toString(),
    name: member.name,
    email: member.email,
    membershipType: member.membershipType,
    joinedAt: member.joinedAt.toISOString(),
    userId: member.user ? member.user.toString() : null,
  };
}

export async function findMemberIdForUser(userId: string): Promise<string | null> {
  const member = await Member.findOne({ user: userId }).select("_id").lean();
  return member ? member._id.toString() : null;
}

export async function listMembers(
  page: number,
  pageSize: number
): Promise<Paginated<MemberDto>> {
  const [members, total] = await Promise.all([
    Member.find()
      .sort({ name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Member.countDocuments(),
  ]);

  return { items: members.map(toMemberDto), total, page, pageSize };
}

async function findMemberOrFail(id: string): Promise<MemberDocument> {
  const member = await Member.findById(id);
  if (!member) throw new NotFoundError("No such member");
  return member;
}

export async function getMember(id: string): Promise<MemberDto> {
  return toMemberDto(await findMemberOrFail(id));
}

export async function createMember(input: CreateMemberBody): Promise<MemberDto> {
  const email = input.email.toLowerCase();
  if (await Member.exists({ email })) {
    throw new ConflictError("A member with that email already exists");
  }

  return toMemberDto(await Member.create({ ...input, email }));
}

export async function updateMember(id: string, patch: UpdateMemberBody): Promise<MemberDto> {
  const member = await findMemberOrFail(id);

  if (patch.name !== undefined) member.name = patch.name;
  if (patch.email !== undefined) member.email = patch.email.toLowerCase();
  if (patch.membershipType !== undefined) member.membershipType = patch.membershipType;

  await member.save();
  return toMemberDto(member);
}

export async function deleteMember(id: string, policy: DeletePolicy): Promise<void> {
  const member = await findMemberOrFail(id);

  await applyDeletePolicy({
    policy,
    reference: "member",
    id: member._id,
    describeBlocked: (activeLoans) =>
      `Cannot delete a member holding ${activeLoans} book(s). Take the returns first.`,
  });

  await member.deleteOne();
}
