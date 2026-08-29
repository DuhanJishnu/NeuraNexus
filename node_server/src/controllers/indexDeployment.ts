import { Request, Response } from 'express';
import {
  indexEvaluationSchema,
  indexVersionSchema,
} from '../schemas/indexDeployment';
import { IndexDeploymentService } from '../services/indexDeployment';


export const listIndexDeployments = async (_req: Request, res: Response) => {
  return res.json({
    activeVersion: await IndexDeploymentService.getActiveVersion(),
    deployments: await IndexDeploymentService.list(),
  });
};

export const registerIndexCandidate = async (req: Request, res: Response) => {
  const parsed = indexVersionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid index version' });
  try {
    return res.status(201).json(
      await IndexDeploymentService.registerCandidate(parsed.data.version),
    );
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
};

export const recordIndexEvaluation = async (req: Request, res: Response) => {
  const parsed = indexEvaluationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid metrics' });
  try {
    return res.json(await IndexDeploymentService.recordEvaluation(
      parsed.data.version, parsed.data.metrics,
    ));
  } catch (error) {
    return res.status(404).json({ error: (error as Error).message });
  }
};

export const promoteIndexCandidate = async (req: Request, res: Response) => {
  const parsed = indexVersionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid index version' });
  try {
    return res.json(await IndexDeploymentService.promote(parsed.data.version));
  } catch (error) {
    return res.status(409).json({ error: (error as Error).message });
  }
};

export const rollbackIndex = async (req: Request, res: Response) => {
  const parsed = indexVersionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid index version' });
  try {
    return res.json(await IndexDeploymentService.rollback(parsed.data.version));
  } catch (error) {
    return res.status(409).json({ error: (error as Error).message });
  }
};
