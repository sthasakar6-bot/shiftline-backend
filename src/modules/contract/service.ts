import {
  findContractsByUser,
  findContractByIdForUser,
  createContract,
  updateContractForUser,
  deleteContractForUser,
  CreateContractInput,
  UpdateContractInput,
} from "./model";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";

export async function listContracts(userId: number) {
  return findContractsByUser(userId);
}

export async function getContract(id: number, userId: number) {
  const contract = await findContractByIdForUser(id, userId);
  if (!contract) {
    throw new AppError(404, "Contract not found");
  }
  return contract;
}

export async function addContract(userId: number, input: Omit<CreateContractInput, "userId">) {
  return createContract({ ...input, userId });
}

export async function editContract(id: number, userId: number, input: UpdateContractInput) {
  const updated = await updateContractForUser(id, userId, input);
  if (!updated) {
    throw new AppError(404, "Contract not found");
  }
  if (input.status) {
    await notify(userId, `Contract "${updated.title}" status changed to ${updated.status}`);
  }
  return updated;
}

export async function removeContract(id: number, userId: number) {
  const existing = await findContractByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Contract not found");
  }
  await deleteContractForUser(id, userId);
}
