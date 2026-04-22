import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export default api;

export interface OrgInfo {
  orgId: string;
  orgName: string;
  userEmail: string;
  instanceUrl: string;
}

export interface MigrationObject {
  apiName: string;
  label: string;
  group: string;
  dependsOn: string[];
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

export interface MigrationJob {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  progress: Record<string, MigrationProgress>;
  log: string[];
}
