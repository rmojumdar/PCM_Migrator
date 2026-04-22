import { Request, Response } from 'express';
import { z } from 'zod';
import { allObjects } from '../services/migration/objects/registry';
import { getRecordCount } from '../services/salesforce/query.service';
import { startMigration as execMigration, getJob } from '../services/migration/executor.service';

export function getObjects(_req: Request, res: Response) {
  const objects = allObjects.map(({ apiName, label, group, dependsOn }) => ({
    apiName, label, group, dependsOn,
  }));
  res.json({ objects });
}

export async function getCounts(req: Request, res: Response) {
  const { sourceOrg, targetOrg } = req.session;
  if (!sourceOrg || !targetOrg) { res.status(401).json({ error: 'Orgs not connected' }); return; }

  const counts: Record<string, { source: number; target: number }> = {};
  await Promise.all(
    allObjects.map(async ({ apiName }) => {
      const [src, tgt] = await Promise.all([
        getRecordCount(sourceOrg, apiName),
        getRecordCount(targetOrg, apiName),
      ]);
      counts[apiName] = { source: src, target: tgt };
    })
  );
  res.json({ counts });
}

export function startMigration(req: Request, res: Response) {
  const schema = z.object({ selectedObjects: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'selectedObjects must be a non-empty array' });
    return;
  }

  const { sourceOrg, targetOrg } = req.session;
  if (!sourceOrg || !targetOrg) { res.status(401).json({ error: 'Orgs not connected' }); return; }

  const jobId = execMigration(sourceOrg, targetOrg, parsed.data.selectedObjects);
  res.json({ jobId });
}

export function getJobStatus(req: Request, res: Response) {
  const job = getJob(req.params.jobId);
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
  res.json(job);
}
