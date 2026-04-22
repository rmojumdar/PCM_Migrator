import axios from 'axios';
import { OrgCredentials, OrgSession } from '../../types';
import { env } from '../../config/env';

export async function connectOrg(creds: OrgCredentials): Promise<OrgSession> {
  const tokenUrl = `${creds.instanceUrl}/services/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  console.log(`[auth] client_credentials request to: ${tokenUrl}`);

  let tokenData: Record<string, string>;
  try {
    const { data } = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    tokenData = data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown } };
    console.error('[auth] Token request failed:', JSON.stringify(axiosErr?.response?.data));
    throw err;
  }

  const instanceUrl: string = tokenData.instance_url;
  const accessToken: string = tokenData.access_token;
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  console.log(`[auth] Token obtained. Instance URL: ${instanceUrl}`);

  const { data: userInfo } = await axios.get(
    `${instanceUrl}/services/oauth2/userinfo`,
    { headers: authHeader }
  );

  let orgName = userInfo.organization_id as string;
  try {
    const { data: queryResult } = await axios.get(
      `${instanceUrl}/services/data/v${env.SF_API_VERSION}/query?q=${encodeURIComponent('SELECT Name FROM Organization LIMIT 1')}`,
      { headers: authHeader }
    );
    orgName = queryResult.records?.[0]?.Name ?? orgName;
  } catch {
    // non-critical
  }

  return {
    instanceUrl,
    accessToken,
    orgId: userInfo.organization_id as string,
    orgName,
    userEmail: userInfo.email as string ?? '',
    credentials: { ...creds, instanceUrl },
  };
}
