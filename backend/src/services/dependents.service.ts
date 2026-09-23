import type { Types } from "mongoose";
import { Loan } from "../models/loan.model";
import { ConflictError } from "../errors/AppError";
import type { DeletePolicy } from "../../../shared/types";

export type LoanReference = "book" | "member";

interface ApplyOptions {
  policy: DeletePolicy;
  reference: LoanReference;
  id: Types.ObjectId;
  describeBlocked: (activeLoans: number) => string;
}

export async function applyDeletePolicy(options: ApplyOptions): Promise<number> {
  const { policy, reference, id, describeBlocked } = options;
  const scope = { [reference]: id };

  if (policy === "block") {
    const activeLoans = await Loan.countDocuments({ ...scope, returnedAt: null });
    if (activeLoans > 0) throw new ConflictError(describeBlocked(activeLoans));
    return 0;
  }

  if (policy === "cascade") {
    const result = await Loan.deleteMany(scope);
    return result.deletedCount;
  }

  const result = await Loan.updateMany(scope, { $set: { [reference]: null } });
  return result.modifiedCount;
}

export function isDeletePolicy(value: unknown): value is DeletePolicy {
  return value === "block" || value === "cascade" || value === "nullify";
}
