import { useState, useEffect } from 'react';
import api, { OrgInfo } from '../api/client';

interface Props {
  role: 'source' | 'target';
  connected: OrgInfo | null;
  onConnect: (info: OrgInfo) => void;
  onDisconnect: () => void;
}

interface FormState {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
}

const empty: FormState = {
  instanceUrl: 'https://login.salesforce.com',
  clientId: '',
  clientSecret: '',
};

export default function OrgConnectForm({ role, connected, onConnect, onDisconnect }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ source: FormState; target: FormState }>('/auth/defaults').then(({ data }) => {
      const defaults = role === 'source' ? data.source : data.target;
      setForm((f) => ({
        ...f,
        ...Object.fromEntries(
          Object.entries(defaults).filter(([, v]) => typeof v === 'string' && v !== '')
        ),
      }));
    }).catch(() => {});
  }, [role]);

  const label = role === 'source' ? 'Source Org' : 'Target Org';
  const borderColor = role === 'source' ? 'border-blue-400' : 'border-green-400';
  const badgeColor = role === 'source' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<OrgInfo>('/auth/connect', { role, ...form });
      onConnect(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(typeof msg === 'string' ? msg : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    await api.delete(`/auth/disconnect?role=${role}`);
    onDisconnect();
  }

  if (connected) {
    return (
      <div className={`rounded-xl border-2 ${borderColor} bg-white p-6 flex flex-col gap-3`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${badgeColor}`}>{label}</span>
          <span className="text-green-500 text-lg font-bold">Connected</span>
        </div>
        <div className="text-sm text-gray-700 space-y-1">
          <p className="font-medium text-base">{connected.orgName || connected.orgId}</p>
          <p className="text-gray-500">{connected.userEmail}</p>
          <p className="text-gray-400 text-xs truncate">{connected.instanceUrl}</p>
        </div>
        <button
          onClick={handleDisconnect}
          className="mt-2 text-sm text-red-600 hover:underline self-start"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-white p-6`}>
      <span className={`text-xs font-semibold px-2 py-1 rounded ${badgeColor}`}>{label}</span>
      <form onSubmit={handleConnect} className="mt-4 flex flex-col gap-3">
        {[
          { key: 'instanceUrl', label: 'Instance URL', type: 'url', placeholder: 'https://yourorg.my.salesforce.com' },
          { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Connected App Client ID' },
          { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Connected App Client Secret' },
        ].map(({ key, label: fieldLabel, type, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{fieldLabel}</label>
            <input
              type={type}
              value={form[key as keyof FormState]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        ))}

        {error && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
        >
          {loading ? 'Connecting...' : `Connect ${label}`}
        </button>
      </form>
    </div>
  );
}
