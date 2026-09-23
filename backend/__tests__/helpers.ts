import { User, type UserDocument } from "../src/models/user.model";
import { Member, type MemberDocument } from "../src/models/member.model";
import { issueAccessToken } from "../src/services/auth.service";
import type { MembershipType, Role } from "../../shared/types";

export const PASSWORD = "correct-horse-battery";

let counter = 0;
function uniqueEmail(role: string): string {
  counter += 1;
  return `${role}-${counter}@example.com`;
}

export interface Actor {
  user: UserDocument;
  member: MemberDocument;
  accessToken: string;
  auth: { Authorization: string };
}

export async function loginAs(
  role: Role,
  options: { membershipType?: MembershipType; isActive?: boolean } = {}
): Promise<Actor> {
  const email = uniqueEmail(role);

  const user = await User.create({
    email,
    passwordHash: PASSWORD,
    role,
    isActive: options.isActive ?? true,
  });

  const member = await Member.create({
    name: `${role} user`,
    email,
    membershipType: options.membershipType ?? "standard",
    user: user._id,
  });

  return {
    user,
    member,
    accessToken: issueAccessToken(user),
    auth: { Authorization: `Bearer ${issueAccessToken(user)}` },
  };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function setCookies(response: { headers: Record<string, unknown> }): string[] {
  const raw = response.headers["set-cookie"];
  if (Array.isArray(raw)) return raw as string[];
  return typeof raw === "string" ? [raw] : [];
}
