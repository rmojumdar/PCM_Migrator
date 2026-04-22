import { Request, Response } from 'express';
import { z } from 'zod';
import { connectOrg as sfConnect } from '../services/salesforce/auth.service';
import { OrgRole } from '../types';
import { env } from '../config/env';

const credentialsSchema = z.object({
  role: z.enum(['source', 'target']),
  instanceUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export async function connectOrg(req: Request, res: Response) {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { role, ...creds } = parsed.data;

  try {
    const orgSession = await sfConnect(creds);
    if (role === 'source') {
      req.session.sourceOrg = orgSession;
    } else {
      req.session.targetOrg = orgSession;
    }
    res.json({
      orgId: orgSession.orgId,
      orgName: orgSession.orgName,
      userEmail: orgSession.userEmail,
      instanceUrl: orgSession.instanceUrl,
    });
  } catch (err: unknown) {
    // Surface the real Salesforce error (e.g. invalid_client, invalid_grant)
    const axiosErr = err as { response?: { data?: { error?: string; error_description?: string } } };
    const sfError = axiosErr?.response?.data;
    if (sfError?.error) {
      res.status(401).json({
        error: `${sfError.error}: ${sfError.error_description ?? ''}`.trim(),
      });
      return;
    }
    const msg = err instanceof Error ? err.message : 'Authentication failed';
    res.status(401).json({ error: msg });
  }
}

export function disconnectOrg(req: Request, res: Response) {
  const role = req.query.role as OrgRole;
  if (role === 'source') {
    req.session.sourceOrg = undefined;
  } else if (role === 'target') {
    req.session.targetOrg = undefined;
  }
  res.json({ ok: true });
}

export function getDefaults(_req: Request, res: Response) {
  res.json({
    source: {
      instanceUrl: env.SOURCE_INSTANCE_URL ?? 'https://login.salesforce.com',
      clientId: env.SOURCE_CLIENT_ID ?? '',
      clientSecret: env.SOURCE_CLIENT_SECRET ?? '',
    },
    target: {
      instanceUrl: env.TARGET_INSTANCE_URL ?? 'https://login.salesforce.com',
      clientId: env.TARGET_CLIENT_ID ?? '',
      clientSecret: env.TARGET_CLIENT_SECRET ?? '',
    },
  });
}

export function getStatus(req: Request, res: Response) {
  const fmt = (role: OrgRole) => {
    const org = role === 'source' ? req.session.sourceOrg : req.session.targetOrg;
    if (!org) return null;
    return { orgId: org.orgId, orgName: org.orgName, userEmail: org.userEmail, instanceUrl: org.instanceUrl };
  };
  res.json({ source: fmt('source'), target: fmt('target') });
}
