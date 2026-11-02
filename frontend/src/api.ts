import type { SystemHealth, UploadResponse, Job, JobOptions } from './types';

// Detect or override Backend API Base URL
export function getCustomApiBase(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('clipforge_custom_api_url');
    if (saved) return saved;
  }
  return import.meta.env.VITE_API_BASE_URL || '';
}

export function setCustomApiBase(url: string) {
  if (typeof window !== 'undefined') {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem('clipforge_custom_api_url', trimmed);
    } else {
      localStorage.removeItem('clipforge_custom_api_url');
    }
    window.location.reload();
  }
}

export function isBackendConfigured(): boolean {
  if (typeof window === 'undefined') return true;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) return true;
  const raw = getCustomApiBase();
  return Boolean(raw && raw !== '/api');
}

export const getApiBase = (): string => {
  const raw = getCustomApiBase();
  if (!raw) return '/api';
  const clean = raw.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

export const API_BASE = getApiBase();

export async function fetchHealth(): Promise<SystemHealth> {
  const base = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/health`);
  } catch (err: any) {
    throw new Error(
      `Cannot connect to backend server at ${base}. Please ensure the backend is running and CORS is enabled.`
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `Backend returned HTML instead of API data. If hosted on Vercel, set VITE_API_BASE_URL to your deployed Python backend URL (e.g., https://clipforge-backend.onrender.com).`
    );
  }

  if (!res.ok) {
    throw new Error(`System health check failed with HTTP ${res.status}`);
  }

  return res.json();
}

export async function requestPresignedUrl(
  filename: string,
  contentType: string = 'video/mp4',
  fileSize?: number
): Promise<{ supported: boolean; upload_url?: string; object_key?: string }> {
  const base = getApiBase();
  const res = await fetch(`${base}/storage/presigned-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content_type: contentType, file_size: fileSize }),
  });

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    return { supported: false };
  }

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
    xhr.timeout = 30 * 60 * 1000; // 30 minutes for large file S3 direct upload

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
    xhr.ontimeout = () => reject(new Error('Storage upload timed out'));
    xhr.send(file);
  });
}

export function uploadVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const base = getApiBase();

    // Check if user is deployed on Vercel without configured backend URL
    if (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      base === '/api'
    ) {
      reject(
        new Error(
          'Vercel cannot process video uploads directly (4.5MB Serverless limit). Please set VITE_API_BASE_URL to your deployed Render/Railway backend.'
        )
      );
      return;
    }

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${base}/upload`);
    xhr.timeout = 20 * 60 * 1000; // 20 minutes

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      const ct = xhr.getResponseHeader('Content-Type') || '';
      if (ct.includes('text/html')) {
        reject(
          new Error(
            'Received HTML instead of API response. Your backend URL may be pointing to Vercel instead of your Python server.'
          )
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error('Invalid JSON response received from backend'));
        }
      } else if (xhr.status === 413) {
        reject(new Error('Video file exceeds maximum allowed upload size (HTTP 413 Payload Too Large).'));
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.detail || `Upload failed with HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          `Network connection to backend at ${base} failed. Check backend deployment and CORS settings.`
        )
      );
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out after 20 minutes. Please check your network connection.'));
    };

    xhr.send(formData);
  });
}

export async function fetchVideoFromUrl(url: string): Promise<UploadResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/upload-url`, {
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
  const base = getApiBase();
  const res = await fetch(`${base}/system/generate-sample`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate demo sample' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function createJob(
  source: string | { file_id?: string; video_url?: string; s3_key?: string },
  options: JobOptions
): Promise<Job> {
  const base = getApiBase();
  const payload = typeof source === 'string' ? { file_id: source, ...options } : { ...source, ...options };
  const res = await fetch(`${base}/jobs`, {
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
  const base = getApiBase();
  const res = await fetch(`${base}/jobs`);
  if (!res.ok) throw new Error('Failed to fetch jobs list');
  return res.json();
}

export async function fetchJob(jobId: string): Promise<Job> {
  const base = getApiBase();
  const res = await fetch(`${base}/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch job details');
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/jobs/${jobId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel job');
}

export async function retryJob(jobId: string): Promise<Job> {
  const base = getApiBase();
  const res = await fetch(`${base}/jobs/${jobId}/retry`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to retry job');
  return res.json();
}

export async function deleteJob(jobId: string): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/jobs/${jobId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete job');
}

export async function triggerCleanup(hours: number = 24): Promise<{ message: string }> {
  const base = getApiBase();
  const res = await fetch(`${base}/system/cleanup?hours=${hours}`, { method: 'POST' });
  if (!res.ok) throw new Error('Cleanup request failed');
  return res.json();
}

export function getClipStreamUrl(jobId: string, clipId: string): string {
  return `${getApiBase()}/jobs/${jobId}/clips/${clipId}/stream`;
}

export function getClipDownloadUrl(jobId: string, clipId: string): string {
  return `${getApiBase()}/jobs/${jobId}/clips/${clipId}/download`;
}

export function getClipThumbnailUrl(jobId: string, clipId: string): string {
  return `${getApiBase()}/jobs/${jobId}/clips/${clipId}/thumbnail`;
}

export function getClipSrtUrl(jobId: string, clipId: string): string {
  return `${getApiBase()}/jobs/${jobId}/clips/${clipId}/srt`;
}

export function getJobZipDownloadUrl(jobId: string): string {
  return `${getApiBase()}/jobs/${jobId}/download-all`;
}

export function connectJobWebSocket(
  jobId: string,
  onUpdate: (job: Job) => void,
  onError?: (err: any) => void
): () => void {
  const base = getApiBase();
  let wsUrl = '';
  if (base.startsWith('http://')) {
    wsUrl = base.replace('http://', 'ws://');
  } else if (base.startsWith('https://')) {
    wsUrl = base.replace('https://', 'wss://');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}${base}`;
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
