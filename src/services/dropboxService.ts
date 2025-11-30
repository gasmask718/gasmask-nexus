// src/services/dropboxService.ts
// WARNING: For a truly secure setup, proxy this through a backend.
// For now, this is fine for a private internal admin tool.

const DROPBOX_API_UPLOAD = 'https://content.dropboxapi.com/2/files/upload';

interface DropboxUploadOptions {
  accessToken: string;
  path: string; // e.g. "/DynastyOS/backups/file.json"
  contents: string | ArrayBuffer;
}

interface DropboxUploadResult {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size: number;
}

export async function uploadToDropbox(
  options: DropboxUploadOptions
): Promise<DropboxUploadResult> {
  const { accessToken, path, contents } = options;

  const res = await fetch(DROPBOX_API_UPLOAD, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: false,
        strict_conflict: false,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: typeof contents === 'string' ? new TextEncoder().encode(contents) : contents,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Dropbox upload failed:', errorText);
    throw new Error('Dropbox upload failed');
  }

  const data = await res.json();
  console.log('☁️ Dropbox upload success:', data);
  return data;
}
