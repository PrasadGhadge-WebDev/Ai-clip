import type { SystemHealth, UploadResponse, Job, JobOptions } from './types';

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || '';
export const API_BASE = (() => {
  if (!RAW_BASE) return '/api';
  const clean = RAW_BASE.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
})();

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

export async function requestPresignedUrl(
  filename: string,
  contentType: string = 'video/mp4',
  fileSize?: number
): Promise<{ supported: boolean; upload_url?: string; object_key?: string }> {
  const res = await fetch(`${API_BASE}/storage/presigned-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content_type: contentType, file_size: fileSize }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to obtain pre-signed URL' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export function uploadFileToS3(
  presignedUrl: string,
  file: File,
  contentType: string = 'video/mp4',
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Direct storage upload failed with HTTP status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during direct storage upload'));
    xhr.send(file);
  });
}

export function uploadVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${API_BASE}/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error('Invalid JSON response from server'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.detail || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during video upload'));
    xhr.send(formData);
  });
}

export async function fetchVideoFromUrl(url: string): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to import video from link' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function generateSyntheticSample(): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/system/generate-sample`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate demo sample' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function createJob(fileId: string, options: JobOptions): Promise<Job> {
  const payload = { file_id: fileId, ...options };
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create job' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/jobs`);
  if (!res.ok) throw new Error('Failed to fetch jobs list');
  return res.json();
}

export async function fetchJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch job details');
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel job');
}

export async function retryJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to retry job');
  return res.json();
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete job');
}

export async function triggerCleanup(hours: number = 24): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/system/cleanup?hours=${hours}`, { method: 'POST' });
  if (!res.ok) throw new Error('Cleanup request failed');
  return res.json();
}

export function getClipStreamUrl(jobId: string, clipId: string): string {
  return `${API_BASE}/jobs/${jobId}/clips/${clipId}/stream`;
}

export function getClipDownloadUrl(jobId: string, clipId: string): string {
  return `${API_BASE}/jobs/${jobId}/clips/${clipId}/download`;
}

export function getClipThumbnailUrl(jobId: string, clipId: string): string {
  return `${API_BASE}/jobs/${jobId}/clips/${clipId}/thumbnail`;
}

export function getClipSrtUrl(jobId: string, clipId: string): string {
  return `${API_BASE}/jobs/${jobId}/clips/${clipId}/srt`;
}

export function getJobZipDownloadUrl(jobId: string): string {
  return `${API_BASE}/jobs/${jobId}/download-all`;
}

export function connectJobWebSocket(
  jobId: string,
  onUpdate: (job: Job) => void,
  onError?: (err: any) => void
): () => void {
  let wsUrl = '';
  if (API_BASE.startsWith('http://')) {
    wsUrl = API_BASE.replace('http://', 'ws://');
  } else if (API_BASE.startsWith('https://')) {
    wsUrl = API_BASE.replace('https://', 'wss://');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}${API_BASE}`;
  }
  const fullWsUrl = `${wsUrl}/ws/jobs/${jobId}`;

  let isClosed = false;
  let socket: WebSocket | null = null;

  try {
    socket = new WebSocket(fullWsUrl);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
      } catch (e) {
        console.error('Failed to parse WS job message:', e);
      }
    };
    socket.onerror = (e) => {
      if (onError && !isClosed) onError(e);
    };
  } catch (err) {
    if (onError) onError(err);
  }

  return () => {
    isClosed = true;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
    }
  };
}

