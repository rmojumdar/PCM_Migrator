export interface OrgCredentials {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface OrgSession {
  instanceUrl: string;
  accessToken: string;
  orgId: string;
  orgName: string;
  userEmail: string;
  credentials: OrgCredentials;
}

export type OrgRole = 'source' | 'target';

export interface MigrationObjectConfig {
  apiName: string;
  label: string;
  group: string;
  dependsOn: string[];
  queryFields: string[];
  externalIdField: string;
  uniqueFields: string[];   // fields used together to detect duplicates in target
  skipFields?: string[];       // fields to exclude from create payload (e.g. autonumber Name)
  skipUpdateFields?: string[]; // fields to exclude from update payload only (e.g. immutable lookups)
  allowUpdate?: boolean;       // if true, update existing records instead of skipping
  lookups: LookupField[];
}

export interface LookupField {
  field: string;
  relatedObject: string;
  relatedExternalId: string;
  optional?: boolean;  // if true, skip field from payload when unresolved instead of failing the record
}

export interface MigrationProgress {
  apiName: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  message: string;
}

export interface MigrationState {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  progress: Record<string, MigrationProgress>;
  log: string[];
}
