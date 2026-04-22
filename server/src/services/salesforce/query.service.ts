import axios from 'axios';
import { OrgSession } from '../../types';
import { env } from '../../config/env';

const base = (org: OrgSession) =>
  `${org.instanceUrl}/services/data/v${env.SF_API_VERSION}`;

const headers = (org: OrgSession) => ({ Authorization: `Bearer ${org.accessToken}` });

export async function queryAll<T = Record<string, unknown>>(
  org: OrgSession,
  soql: string
): Promise<T[]> {
  const all: T[] = [];
  let url: string | null = `${base(org)}/query?q=${encodeURIComponent(soql)}`;

  while (url) {
    const { data } = await axios.get<{ records: T[]; done: boolean; nextRecordsUrl?: string }>(
      url,
      { headers: headers(org) }
    );
    all.push(...data.records);
    url = data.done ? null : `${org.instanceUrl}${data.nextRecordsUrl}`;
  }

  return all;
}

export async function createRecord(
  org: OrgSession,
  objectApiName: string,
  data: Record<string, unknown>
): Promise<{ id: string }> {
  const url = `${base(org)}/sobjects/${objectApiName}`;
  const { data: result } = await axios.post(url, data, {
    headers: { ...headers(org), 'Content-Type': 'application/json' },
  });
  return { id: result?.id ?? '' };
}

export async function updateRecord(
  org: OrgSession,
  objectApiName: string,
  targetId: string,
  data: Record<string, unknown>
): Promise<void> {
  const url = `${base(org)}/sobjects/${objectApiName}/${targetId}`;
  await axios.patch(url, data, {
    headers: { ...headers(org), 'Content-Type': 'application/json' },
  });
}

export async function getRecordCount(org: OrgSession, objectApiName: string): Promise<number> {
  try {
    const { data } = await axios.get(
      `${base(org)}/query?q=${encodeURIComponent(`SELECT COUNT() FROM ${objectApiName}`)}`,
      { headers: headers(org) }
    );
    return data.totalSize ?? 0;
  } catch {
    return 0;
  }
}
