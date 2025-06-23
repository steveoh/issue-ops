import type { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import {
  auth,
  AuthClient,
  BaseExternalAccountClient,
  GoogleAuth,
  Impersonated,
  JWT,
  UserRefreshClient,
} from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { randomInt } from 'node:crypto';

// Define JSONClient locally since it's not exported from the main module
// Note: ExternalAccountAuthorizedUserClient is not exported from the main module index
type JSONClient =
  | JWT
  | UserRefreshClient
  | BaseExternalAccountClient
  | Impersonated;

let cachedRows: any[] | undefined;
type RowData = {
  id: string;
};

function retry(client: AxiosInstance) {
  axiosRetry(client, {
    retries: 7,
    retryDelay: (retryCount) => {
      const randomNumberMS = randomInt(1000, 8001); // randomInt is exclusive of the upper bound
      return Math.min(4 ** retryCount + randomNumberMS, 20000);
    },
    retryCondition: (error) => error.response?.status === 429,
  });
}

export async function validateSgidIndexId(id: string) {
  const rows = await getWorksheetData();

  const row = rows.find((row) => row.get('id') === id);

  if (!row) {
    return -1;
  }

  return row.rowNumber ?? row._rowNumber ?? -1;
}

async function getWorksheetData() {
  if (cachedRows) {
    return cachedRows;
  }

  const spreadsheetId = '11ASS7LnxgpnD0jN4utzklREgMf1pcvYjcXcIcESHweQ';
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ];

  let client: GoogleAuth<AuthClient> | JSONClient;
  if (process.env.GITHUB_ACTIONS) {
    console.log('🤖 using ci credentials');
    client = auth.fromJSON(
      JSON.parse(process.env.GOOGLE_PRIVATE_KEY!),
    ) as JSONClient;
    (client as any).scopes = scopes;
  } else {
    if (!process.env.NODE_ENV?.includes('test')) {
      console.log(
        '🔐 using local credentials (Application Default Credentials)',
      );
    }
    client = new GoogleAuth({
      scopes,
    });
  }

  const spreadsheet = new GoogleSpreadsheet(spreadsheetId, client);

  retry(spreadsheet.sheetsApi);
  retry(spreadsheet.driveApi);

  await spreadsheet.loadInfo();

  const worksheet = spreadsheet.sheetsByTitle['SGID Index'];

  if (!worksheet) {
    throw new Error('Worksheet not found');
  }

  const rows = await worksheet.getRows<RowData>();

  cachedRows = rows;

  return rows;
}
