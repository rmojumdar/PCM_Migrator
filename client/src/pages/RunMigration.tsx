import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { MigrationJob, MigrationProgress } from '../api/client';

const STATUS_ICON: Record<MigrationProgress['status'], string> = {
  pending: '⏳',
  running: '🔄',
  done: '✅',
  error: '❌',
  skipped: '⏭',
};

const STATUS_COLOR: Record<MigrationProgress['status'], string> = {
  pending: 'text-gray-400',
  running: 'text-blue-600',
  done: 'text-green-600',
  error: 'text-red-600',
  skipped: 'text-gray-400',
};

export default function RunMigration() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<MigrationJob | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get<MigrationJob>(`/migration/job/${jobId}`);
        setJob(data);
        if (data.status !== 'running') clearInterval(interval);
      } catch {
        clearInterval(interval);
      }
    }, 1500);

    // Initial fetch
    api.get<MigrationJob>(`/migration/job/${jobId}`).then(({ data }) => setJob(data));

    return () => clearInterval(interval);
  }, [jobId]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [job?.log]);

  if (!job) {
    return <div className="text-gray-500 text-sm">Loading migration status...</div>;
  }

  const progressList = job.plan
    ? job.plan.map((name) => job.progress[name]).filter(Boolean)
    : Object.values(job.progress);

  const total = progressList.reduce((s, p) => s + p.total, 0);
  const processed = progressList.reduce((s, p) => s + p.processed, 0);
  const totalCreated = progressList.reduce((s, p) => s + p.created, 0);
  const totalUpdated = progressList.reduce((s, p) => s + p.updated, 0);
  const totalSkipped = progressList.reduce((s, p) => s + (p.skipped ?? 0), 0);
  const totalFailed = progressList.reduce((s, p) => s + p.failed, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {job.status === 'running' ? 'Migration In Progress...' : 'Migration Complete'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">Job ID: {jobId}</p>
        </div>
        {job.status !== 'running' && (
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 text-sm"
          >
            Start New Migration
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Records', value: total.toLocaleString(), color: 'text-gray-800' },
          { label: 'Created', value: totalCreated.toLocaleString(), color: 'text-green-600' },
          { label: 'Skipped (duplicate)', value: totalSkipped.toLocaleString(), color: 'text-yellow-600' },
          { label: 'Failed', value: totalFailed.toLocaleString(), color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      {total > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Overall Progress</span>
            <span>{processed}/{total}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${total > 0 ? Math.round((processed / total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Per-object progress */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-6">
        {progressList.map((p) => (
          <div key={p.apiName} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">{STATUS_ICON[p.status]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-800">{p.apiName}</span>
                  <span className={`text-xs font-medium ${STATUS_COLOR[p.status]}`}>
                    {p.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{p.message}</p>
                {p.total > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 transition-all duration-500"
                        style={{ width: `${Math.round((p.processed / p.total) * 100)}%` }}
                      />
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span className="text-green-600">Created: {p.created}</span>
                      {(p.skipped ?? 0) > 0 && (
                        <span className="text-yellow-600">Skipped: {p.skipped} (already exist)</span>
                      )}
                      {p.failed > 0 && <span className="text-red-500">Failed: {p.failed}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Log */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Migration Log</h3>
        <div
          ref={logRef}
          className="bg-gray-900 text-green-400 font-mono text-xs rounded-xl p-4 h-64 overflow-y-auto"
        >
          {job.log.map((line, i) => (
            <div key={i} className={line.includes('ERROR') || line.includes('FAILED') ? 'text-red-400' : line.includes('Completed') || line.includes('completed') ? 'text-green-300' : ''}>
              {line}
            </div>
          ))}
          {job.status === 'running' && (
            <div className="animate-pulse text-gray-500">█</div>
          )}
        </div>
      </div>
    </div>
  );
}
