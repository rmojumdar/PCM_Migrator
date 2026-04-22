import { Request, Response, NextFunction } from 'express';
import { OrgRole } from '../types';

export function requireOrg(...roles: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const role of roles) {
      const org = role === 'source' ? req.session.sourceOrg : req.session.targetOrg;
      if (!org) {
        res.status(401).json({ error: `${role} org not connected` });
        return;
      }
    }
    next();
  };
}
