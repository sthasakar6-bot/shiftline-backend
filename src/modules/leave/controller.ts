import { Request, Response } from "express";
import {
  listLeaveRequests,
  requestLeave,
  cancelLeaveRequest,
  decideLeaveRequest,
  revokeApprovedLeave,
} from "./service";

export async function listLeaveRequestsController(req: Request, res: Response) {
  const requests = await listLeaveRequests(req.user!.sub);
  res.json(requests);
}

export async function createLeaveRequestController(req: Request, res: Response) {
  const { type, startDate, endDate, reason } = req.body;
  const request = await requestLeave(req.user!.sub, { type, startDate, endDate, reason });
  res.status(201).json(request);
}

export async function cancelLeaveRequestController(req: Request, res: Response) {
  await cancelLeaveRequest(Number(req.params.id), req.user!.sub);
  res.status(204).send();
}

export async function listLeaveRequestsForReportController(req: Request, res: Response) {
  const requests = await listLeaveRequests(Number(req.params.id));
  res.json(requests);
}

export async function decideLeaveRequestController(req: Request, res: Response) {
  const { status } = req.body;
  const request = await decideLeaveRequest(
    Number(req.params.requestId),
    Number(req.params.id),
    status,
  );
  res.json(request);
}

export async function revokeApprovedLeaveController(req: Request, res: Response) {
  const request = await revokeApprovedLeave(Number(req.params.requestId), Number(req.params.id));
  res.json(request);
}
