import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { MigrationObject } from '../api/client';

const GROUP_ORDER = ['Core', 'Catalog', 'Pricing', 'Classifications', 'Attributes'];


export default function SelectObjects() {
  const [objects, setObjects] = useState<MigrationObject[]>([]);
  const [counts, setCounts] = useState<Record<string, { source: number; target: number }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [autoIncluded, setAutoIncluded] = useState<string[]>([]);
  const [countsLoading, setCountsLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ objects: MigrationObject[] }>('/migration/objects').then(({ data }) => {
      setObjects(data.objects);
    }).catch(() => navigate('/'));
  }, [navigate]);

  useEffect(() => {
    if (objects.length === 0) return;
    setCountsLoading(true);
    api.get<{ counts: Record<string, { source: number; target: number }> }>('/migration/counts')
      .then(({ data }) => setCounts(data.counts))
      .finally(() => setCountsLoading(false));
  }, [objects]);

  function toggle(apiName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(apiName)) {
        next.delete(apiName);
      } else {
        next.add(apiName);
      }
      return next;
    });
  }

  // Compute auto-included dependencies
  useEffect(() => {
    const required = new Set(selected);
    function addDeps(name: string) {
      const obj = objects.find((o) => o.apiName === name);
      obj?.dependsOn.forEach((dep) => {
        if (!required.has(dep)) { required.add(dep); addDeps(dep); }
      });
    }
    [...selected].forEach(addDeps);
    setAutoIncluded([...required].filter((n) => !selected.has(n)));
  }, [selected, objects]);

  async function handleStart() {
    if (selected.size === 0) return;
    setStarting(true);
    setError(null);
    try {
      const { data } = await api.post<{ jobId: string }>('/migration/start', {
        selectedObjects: [...selected],
      });
      navigate(`/migrate/${data.jobId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(typeof msg === 'string' ? msg : 'Failed to start migration');
      setStarting(false);
    }
  }

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: objects.filter((o) => o.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Select Objects to Migrate</h2>
      <p className="text-gray-500 mb-6 text-sm">
        Choose which Revenue Cloud objects to migrate. Dependencies will be auto-included.
      </p>

      {autoIncluded.length > 0 && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
          <strong>Auto-included dependencies:</strong> {autoIncluded.join(', ')}
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group}</h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {items.map((obj) => {
                const isSelected = selected.has(obj.apiName);
                const isAuto = autoIncluded.includes(obj.apiName);
                const c = counts[obj.apiName];

                return (
                  <label
                    key={obj.apiName}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${isAuto ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected || isAuto}
                      onChange={() => !isAuto && toggle(obj.apiName)}
                      disabled={isAuto}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-800">{obj.label}</span>
                        <span className="text-xs text-gray-400">{obj.apiName}</span>
                        {isAuto && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                            auto-included
                          </span>
                        )}
                      </div>
                      {obj.dependsOn.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Requires: {obj.dependsOn.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500 min-w-[140px]">
                      {countsLoading ? (
                        <span className="text-gray-300">Loading...</span>
                      ) : c ? (
                        <span>
                          Source: <strong>{c.source.toLocaleString()}</strong>
                          &nbsp;&nbsp;Target: <strong>{c.target.toLocaleString()}</strong>
                        </span>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-red-600 text-sm bg-red-50 rounded p-2">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <button
          onClick={handleStart}
          disabled={selected.size === 0 || starting}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors"
        >
          {starting ? 'Starting...' : `Run Migration (${selected.size + autoIncluded.length} objects)`}
        </button>
      </div>
    </div>
  );
}
