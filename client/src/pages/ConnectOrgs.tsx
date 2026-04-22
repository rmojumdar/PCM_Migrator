import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { OrgInfo } from '../api/client';
import OrgConnectForm from '../components/OrgConnectForm';

export default function ConnectOrgs() {
  const [source, setSource] = useState<OrgInfo | null>(null);
  const [target, setTarget] = useState<OrgInfo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ source: OrgInfo | null; target: OrgInfo | null }>('/auth/status').then(({ data }) => {
      setSource(data.source);
      setTarget(data.target);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Connect Orgs</h2>
      <p className="text-gray-500 mb-8 text-sm">
        Connect both orgs using a Salesforce Connected App (OAuth 2.0 Username-Password flow).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OrgConnectForm
          role="source"
          connected={source}
          onConnect={(info) => setSource(info)}
          onDisconnect={() => setSource(null)}
        />
        <OrgConnectForm
          role="target"
          connected={target}
          onConnect={(info) => setTarget(info)}
          onDisconnect={() => setTarget(null)}
        />
      </div>

      {source && target && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => navigate('/select')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors"
          >
            Next: Select Objects →
          </button>
        </div>
      )}
    </div>
  );
}
