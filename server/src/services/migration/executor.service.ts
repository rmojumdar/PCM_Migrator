import { v4 as uuidv4 } from 'uuid';
import { OrgSession, MigrationState, MigrationProgress, MigrationObjectConfig } from '../../types';
import { objectRegistry } from './objects/registry';
import { getOrderedObjects } from './dag.service';
import { queryAll, createRecord, updateRecord } from '../salesforce/query.service';

const jobs = new Map<string, MigrationState>();

export function getJob(jobId: string): MigrationState | undefined {
  return jobs.get(jobId);
}

export function startMigration(
  sourceOrg: OrgSession,
  targetOrg: OrgSession,
  selectedObjects: string[]
): string {
  const jobId = uuidv4();
  const { ordered, autoIncluded } = getOrderedObjects(selectedObjects);

  const progress: Record<string, MigrationProgress> = {};
  for (const apiName of ordered) {
    progress[apiName] = {
      apiName,
      status: 'pending',
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      message: 'Waiting...',
    };
  }

  const state: MigrationState = {
    jobId,
    status: 'running',
    progress,
    log: autoIncluded.length > 0
      ? [`Auto-included dependencies: ${autoIncluded.join(', ')}`]
      : [],
  };

  jobs.set(jobId, state);

  runMigration(jobId, sourceOrg, targetOrg, ordered).catch((err) => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.log.push(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  return jobId;
}

// Builds a composite key string from a record using the object's uniqueFields
function compositeKey(record: Record<string, unknown>, fields: string[]): string {
  return fields.map((f) => String(record[f] ?? '').toLowerCase()).join('||');
}

// Same as compositeKey but translates source lookup IDs → target IDs via idMap before hashing.
// Required when uniqueFields contain lookup IDs that differ between orgs (e.g. ProductClassificationAttr).
function resolvedCompositeKey(
  record: Record<string, unknown>,
  fields: string[],
  lookupFields: Set<string>,
  idMap: Map<string, string>
): string {
  return fields.map((f) => {
    const raw = String(record[f] ?? '');
    if (raw && lookupFields.has(f)) {
      return (idMap.get(raw) ?? raw).toLowerCase();
    }
    return raw.toLowerCase();
  }).join('||');
}

// Errors that should be treated as skips rather than failures
const SKIP_ERROR_CODES = new Set([
  'INVALID_INPUT', // e.g. attribute already present in classification hierarchy
]);

function parseSfError(err: unknown): { code: string; message: string } {
  const sfErr = (err as { response?: { data?: { message?: string; errorCode?: string }[] } })?.response?.data;
  if (Array.isArray(sfErr) && sfErr[0]?.message) {
    return { code: sfErr[0].errorCode ?? 'UNKNOWN', message: sfErr[0].message };
  }
  return { code: 'UNKNOWN', message: err instanceof Error ? err.message : String(err) };
}

// Fetches all existing records from target and returns a Set of composite keys
async function buildExistingKeySet(
  targetOrg: OrgSession,
  node: MigrationObjectConfig
): Promise<{ keySet: Set<string>; targetRecords: Record<string, unknown>[] }> {
  const fieldsToFetch = ['Id', ...new Set([...node.uniqueFields, node.externalIdField])];
  const targetRecords = await queryAll<Record<string, unknown>>(
    targetOrg,
    `SELECT ${fieldsToFetch.join(', ')} FROM ${node.apiName}`
  );
  const keySet = new Set(targetRecords.map((r) => compositeKey(r, node.uniqueFields)));
  return { keySet, targetRecords };
}

function duplicateSkipMessage(apiName: string, record: Record<string, unknown>, uniqueFields: string[]): string {
  const values = uniqueFields.map((f) => `${f}: "${record[f] ?? ''}"`).join(', ');
  return `SKIP — already exists in target org (${values})`;
}

async function runMigration(
  jobId: string,
  sourceOrg: OrgSession,
  targetOrg: OrgSession,
  ordered: string[]
) {
  const job = jobs.get(jobId)!;
  const idMap = new Map<string, string>();

  for (const apiName of ordered) {
    const node = objectRegistry.get(apiName);
    if (!node) continue;

    const p = job.progress[apiName];
    p.status = 'running';
    p.message = 'Querying source org...';
    job.log.push(`[${apiName}] Starting migration...`);

    try {
      const fields = node.queryFields.join(', ');
      let sourceRecords: Record<string, unknown>[];
      try {
        sourceRecords = await queryAll<Record<string, unknown>>(
          sourceOrg,
          `SELECT ${fields} FROM ${apiName}`
        );
      } catch (err: unknown) {
        const sfErr = (err as { response?: { data?: { message?: string; errorCode?: string }[] } })?.response?.data;
        const msg = Array.isArray(sfErr) && sfErr[0]?.message
          ? `${sfErr[0].errorCode}: ${sfErr[0].message}`
          : err instanceof Error ? err.message : String(err);
        p.status = 'skipped';
        p.message = `Not available in source org — ${msg}`;
        job.log.push(`[${apiName}] SKIPPED — object not available in source org: ${msg}`);
        continue;
      }

      p.total = sourceRecords.length;
      job.log.push(`[${apiName}] Found ${sourceRecords.length} records in source org`);

      if (sourceRecords.length === 0) {
        p.status = 'done';
        p.message = 'No records to migrate';
        continue;
      }

      // Fetch target records and build duplicate key set
      p.message = 'Checking target org for existing records...';
      let existingKeys: Set<string>;
      let targetRecords: Record<string, unknown>[];
      try {
        ({ keySet: existingKeys, targetRecords } = await buildExistingKeySet(targetOrg, node));
      } catch {
        existingKeys = new Set();
        targetRecords = [];
        job.log.push(`[${apiName}] WARNING — could not query target org for duplicates, will attempt to create all records`);
      }

      job.log.push(
        `[${apiName}] Target org has ${targetRecords.length} existing records. ` +
        `Duplicate check using: ${node.uniqueFields.join(' + ')}`
      );

      // Pre-populate idMap for records that already exist in target (needed for downstream lookups)
      // Use resolvedCompositeKey so uniqueFields that contain lookup IDs are translated to target IDs
      // before comparing — without this, objects like ProductClassificationAttr never match cross-org.
      const lookupFieldSet = new Set(node.lookups.map((l) => l.field));
      const targetByCompositeKey = new Map(
        targetRecords.map((r) => [compositeKey(r, node.uniqueFields), r])
      );
      for (const sourceRec of sourceRecords) {
        const key = resolvedCompositeKey(sourceRec, node.uniqueFields, lookupFieldSet, idMap);
        const targetRec = targetByCompositeKey.get(key);
        if (sourceRec['Id'] && targetRec?.['Id']) {
          idMap.set(sourceRec['Id'] as string, targetRec['Id'] as string);
        }
      }

      p.message = `Migrating ${sourceRecords.length} records...`;

      for (const record of sourceRecords) {
        const externalIdValue = record[node.externalIdField] as string;

        if (!externalIdValue) {
          p.failed++;
          p.processed++;
          job.log.push(`[${apiName}] SKIP — missing ${node.externalIdField}`);
          continue;
        }

        // Duplicate check using composite uniqueFields (resolve lookup IDs to target IDs for cross-org comparison)
        const key = resolvedCompositeKey(record, node.uniqueFields, lookupFieldSet, idMap);
        if (existingKeys.has(key)) {
          if (node.allowUpdate) {
            // Find the target record ID for this record
            const targetRec = targetRecords.find(
              (t) => compositeKey(t, node.uniqueFields) === key
            );
            const targetId = targetRec?.['Id'] as string | undefined;
            if (!targetId) {
              p.skipped++;
              p.processed++;
              job.log.push(`[${apiName}] SKIP "${externalIdValue}" — duplicate found but target ID could not be resolved`);
              continue;
            }
            // Build update payload — exclude Id, attributes, skipFields, and immutable lookup fields
            const skipFieldSet = new Set(['Id', 'attributes', ...(node.skipFields ?? []), ...(node.skipUpdateFields ?? [])]);
            const updatePayload: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(record)) {
              if (skipFieldSet.has(k)) continue;
              updatePayload[k] = v;
            }
            // Resolve lookups (only those not skipped on update)
            let skipRecord = false;
            for (const lookup of node.lookups) {
              if (skipFieldSet.has(lookup.field)) continue;
              const sourceId = record[lookup.field] as string | undefined;
              if (!sourceId) continue;
              const resolvedId = idMap.get(sourceId);
              if (!resolvedId) {
                p.failed++;
                p.processed++;
                job.log.push(`[${apiName}] ERROR updating "${externalIdValue}" — could not resolve ${lookup.field}`);
                skipRecord = true;
                break;
              }
              updatePayload[lookup.field] = resolvedId;
            }
            if (skipRecord) continue;
            try {
              await updateRecord(targetOrg, apiName, targetId, updatePayload);
              if (record['Id']) idMap.set(record['Id'] as string, targetId);
              p.updated++;
              p.processed++;
              job.log.push(`[${apiName}] Updated "${externalIdValue}"`);
            } catch (err: unknown) {
              const { code, message } = parseSfError(err);
              if (SKIP_ERROR_CODES.has(code)) {
                p.skipped++;
                p.processed++;
                job.log.push(`[${apiName}] SKIP updating "${externalIdValue}": ${message}`);
              } else {
                p.failed++;
                p.processed++;
                job.log.push(`[${apiName}] ERROR updating "${externalIdValue}": ${code}: ${message}`);
              }
            }
            continue;
          }
          p.skipped++;
          p.processed++;
          job.log.push(`[${apiName}] ${duplicateSkipMessage(apiName, record, node.uniqueFields)}`);
          continue;
        }

        // Build payload — exclude Id, attributes, and any object-specific skipFields
        const skipFieldSet = new Set(['Id', 'attributes', ...(node.skipFields ?? [])]);
        const payload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(record)) {
          if (skipFieldSet.has(k)) continue;
          payload[k] = v;
        }

        // Resolve lookup fields via idMap
        let skipRecord = false;
        for (const lookup of node.lookups) {
          const sourceId = record[lookup.field] as string | undefined;
          if (!sourceId) continue;
          const targetId = idMap.get(sourceId);
          if (!targetId) {
            if (lookup.optional) {
              // Remove the unresolved field from payload and continue
              delete payload[lookup.field];
              job.log.push(`[${apiName}] WARN "${externalIdValue}" — optional field ${lookup.field} could not be resolved, omitting`);
              continue;
            }
            p.failed++;
            p.processed++;
            job.log.push(
              `[${apiName}] ERROR on "${externalIdValue}" — could not resolve ${lookup.field} (source ID: ${sourceId}). Parent record may not have been migrated.`
            );
            skipRecord = true;
            break;
          }
          payload[lookup.field] = targetId;
        }

        if (skipRecord) continue;

        try {
          const { id } = await createRecord(targetOrg, apiName, payload);

          if (record['Id'] && id) idMap.set(record['Id'] as string, id);

          p.created++;
          p.processed++;
          job.log.push(`[${apiName}] Created "${externalIdValue}" (id: ${id})`);
        } catch (err: unknown) {
          const { code, message } = parseSfError(err);
          if (SKIP_ERROR_CODES.has(code)) {
            p.skipped++;
            p.processed++;
            job.log.push(`[${apiName}] SKIP "${externalIdValue}": ${message}`);
          } else {
            p.failed++;
            p.processed++;
            job.log.push(`[${apiName}] ERROR on "${externalIdValue}": ${code}: ${message}`);
          }
        }
      }

      p.status = 'done';
      p.message = `Done — ${p.created} created, ${p.skipped} skipped (already exist), ${p.failed} failed`;
      job.log.push(`[${apiName}] Completed: ${p.created} created, ${p.skipped} skipped, ${p.failed} failed`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      p.status = 'error';
      p.message = msg;
      job.log.push(`[${apiName}] FAILED: ${msg}`);
    }
  }

  job.status = 'completed';
  job.log.push('Migration completed.');
}
