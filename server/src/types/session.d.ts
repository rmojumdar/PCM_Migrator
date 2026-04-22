import 'express-session';
import { OrgSession } from './index';

declare module 'express-session' {
  interface SessionData {
    sourceOrg?: OrgSession;
    targetOrg?: OrgSession;
  }
}
