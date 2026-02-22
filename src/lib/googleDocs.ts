import type { OutlineItem } from '../types';

declare global {
  interface Window {
    gapi: {
      load: (library: string, callback: () => void) => void;
      client: {
        init: (params: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        docs: {
          documents: {
            create: (params: { title: string }) => Promise<{ result: { documentId: string } }>;
            batchUpdate: (params: {
              documentId: string;
              resource: { requests: Record<string, unknown>[] };
            }) => Promise<void>;
          };
        };
      };
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (params: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            callback: (response: { access_token?: string; error?: string }) => void;
            requestAccessToken: (params: { prompt: string }) => void;
          };
        };
      };
    };
  }
}

const DOCS_SCOPE = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://docs.googleapis.com/$discovery/rest?version=v1';
const GAPI_SCRIPT = 'https://apis.google.com/js/api.js';
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

let initialized = false;
let accessToken = '';
let tokenClient:
  | {
      callback: (response: { access_token?: string; error?: string }) => void;
      requestAccessToken: (params: { prompt: string }) => void;
    }
  | undefined;

async function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(script);
  });
}

function ensureEnv(): { apiKey: string; clientId: string } {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!apiKey || !clientId) {
    throw new Error('Missing VITE_GOOGLE_API_KEY or VITE_GOOGLE_CLIENT_ID in .env.local');
  }

  return { apiKey, clientId };
}

export async function initGoogleClients(): Promise<void> {
  if (initialized) {
    return;
  }

  const { apiKey, clientId } = ensureEnv();

  await Promise.all([loadScript(GAPI_SCRIPT), loadScript(GIS_SCRIPT)]);

  await new Promise<void>((resolve) => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        apiKey,
        discoveryDocs: [DISCOVERY_DOC]
      });
      resolve();
    });
  });

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DOCS_SCOPE,
    callback: (response: { access_token?: string }) => {
      accessToken = response.access_token ?? '';
    }
  });

  initialized = true;
}

async function requestAccessToken(): Promise<string> {
  if (!tokenClient) {
    await initGoogleClients();
  }

  return new Promise<string>((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google token client failed to initialize'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      accessToken = response.access_token ?? '';
      resolve(accessToken);
    };

    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function uploadImageToDrive(token: string, imageBlob: Blob): Promise<string> {
  const metadata = {
    name: `mindmap-${Date.now()}.png`,
    mimeType: 'image/png'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', imageBlob);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    }
  );

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image to Drive');
  }

  const uploadData = (await uploadResponse.json()) as { id: string };

  const permissionsResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    }
  );

  if (!permissionsResponse.ok) {
    throw new Error('Failed to make exported image readable by Google Docs');
  }

  return `https://drive.google.com/uc?id=${uploadData.id}`;
}

function buildOutlineText(outline: OutlineItem[]): string {
  return outline.map((item) => `${'\t'.repeat(item.depth)}${item.text}\n`).join('');
}

export async function exportToGoogleDoc(params: {
  title: string;
  outline: OutlineItem[];
  imageBlob: Blob;
}): Promise<{ documentId: string; documentUrl: string }> {
  await initGoogleClients();
  const token = await requestAccessToken();

  const createResponse = await window.gapi.client.docs.documents.create({ title: params.title });
  const documentId = createResponse.result.documentId;

  const heading = `${params.title}\n\nOutline\n`;
  const outlineText = buildOutlineText(params.outline);
  const outlineStart = 1 + heading.length;
  const outlineEnd = outlineStart + outlineText.length;
  const hasOutline = params.outline.length > 0;

  const requests: Record<string, unknown>[] = [
    {
      insertText: {
        location: { index: 1 },
        text: heading + outlineText
      }
    },
    {
      updateParagraphStyle: {
        range: {
          startIndex: 1,
          endIndex: params.title.length + 1
        },
        paragraphStyle: {
          namedStyleType: 'HEADING_1'
        },
        fields: 'namedStyleType'
      }
    },
    {
      updateParagraphStyle: {
        range: {
          startIndex: params.title.length + 3,
          endIndex: params.title.length + 10
        },
        paragraphStyle: {
          namedStyleType: 'HEADING_2'
        },
        fields: 'namedStyleType'
      }
    }
  ];

  if (hasOutline) {
    requests.push({
      createParagraphBullets: {
        range: {
          startIndex: outlineStart,
          endIndex: outlineEnd
        },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
      }
    });
  }

  await window.gapi.client.docs.documents.batchUpdate({
    documentId,
    resource: {
      requests
    }
  });

  const imageUrl = await uploadImageToDrive(token, params.imageBlob);

  await window.gapi.client.docs.documents.batchUpdate({
    documentId,
    resource: {
      requests: [
        {
          insertText: {
            endOfSegmentLocation: { segmentId: '' },
            text: '\nMind Map Image\n'
          }
        },
        {
          insertInlineImage: {
            endOfSegmentLocation: { segmentId: '' },
            uri: imageUrl,
            objectSize: {
              width: { magnitude: 500, unit: 'PT' }
            }
          }
        }
      ]
    }
  });

  return {
    documentId,
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`
  };
}
