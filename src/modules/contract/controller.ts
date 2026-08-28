import { Request, Response } from "express";
import { listContracts, getContract, addContract, editContract, removeContract } from "./service";

export async function listContractsController(req: Request, res: Response) {
  const contracts = await listContracts(req.user!.sub);
  res.json(contracts);
}

export async function getContractController(req: Request, res: Response) {
  const contract = await getContract(Number(req.params.id), req.user!.sub);
  res.json(contract);
}

export async function listContractsForReportController(req: Request, res: Response) {
  const contracts = await listContracts(Number(req.params.id));
  res.json(contracts);
}

export async function createContractForReportController(req: Request, res: Response) {
  const { title, description, startDate, endDate, status } = req.body;
  const contract = await addContract(Number(req.params.id), {
    title,
    description,
    startDate,
    endDate,
    status,
  });
  res.status(201).json(contract);
}

export async function updateContractForReportController(req: Request, res: Response) {
  const { title, description, startDate, endDate, status } = req.body;
  const contract = await editContract(Number(req.params.contractId), Number(req.params.id), {
    title,
    description,
    startDate,
    endDate,
    status,
  });
  res.json(contract);
}

export async function deleteContractForReportController(req: Request, res: Response) {
  await removeContract(Number(req.params.contractId), Number(req.params.id));
  res.status(204).send();
}
