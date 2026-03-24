import { google } from 'googleapis';

const DRIVE_FOLDER_ID = process.env.FINANCE_INSIGHTS_DRIVE_FOLDER_ID || '1jBZ94VMVZ_9mNyeHnSkbhAY8odDgjWMO';

function getGoogleAuth() {
  const saRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saRaw) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON env var (service account JSON)');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saRaw);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: (serviceAccount.private_key || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return auth;
}

export async function getDriveFileContent(fileId) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });

  const resp = await drive.files.get({
    fileId,
    alt: 'media',
  });

  return resp.data;
}

export async function getDriveFiles(folderId) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });

  const files = [];
  let pageToken = undefined;

  do {
    const resp = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, iconLink, webContentLink, webViewLink, thumbnailLink)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const batch = resp?.data?.files || [];
    for (const f of batch) {
      files.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        iconLink: f.iconLink || null,
        webContentLink: f.webContentLink || null,
        webViewLink: f.webViewLink || null,
        thumbnailLink: f.thumbnailLink || null,
      });
    }

    pageToken = resp?.data?.nextPageToken;
  } while (pageToken);

  return files;
}

export function getDefaultDriveFolderId() {
  return DRIVE_FOLDER_ID;
}
