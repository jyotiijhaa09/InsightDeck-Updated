/**
 * API Service for InsightDeck Frontend.
 * Handles communication with the FastAPI backend with Firebase Auth token support.
 */

import { getIdToken } from './firebaseAuth';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function getAuthHeaders(extraHeaders = {}) {
  const token = getIdToken();
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Checks backend health status.
 * @returns {Promise<{status: string, ok: boolean}>}
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { status: 'unhealthy', ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { ...data, ok: true };
  } catch (err) {
    return {
      status: 'disconnected',
      ok: false,
      error: err instanceof Error ? err.message : 'Backend unreachable',
    };
  }
}

/**
 * Uploads an Excel (.xlsx) file to the backend under authenticated user's scope.
 * @param {File} file
 * @returns {Promise<any>}
 */
export async function uploadExcel(file) {
  if (!file) {
    throw new Error('No file selected');
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Only .xlsx Excel files are supported.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Upload failed with status ${response.status}`);
  }

  return data;
}

/**
 * Fetches the structured report from the backend for the current user.
 * @returns {Promise<any>}
 */
export async function getReport() {
  const response = await fetch(`${API_BASE_URL}/report`, {
    method: 'GET',
    headers: getAuthHeaders({
      'Accept': 'application/json',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Failed to fetch report (HTTP ${response.status})`);
  }

  return data;
}

/**
 * Sends a natural language query to the data-aware chatbot.
 * @param {string} message
 * @returns {Promise<{answer: string, data: any}>}
 */
export async function sendMessageToChatbot(message) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
    body: JSON.stringify({ message }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Chat request failed (HTTP ${response.status})`);
  }

  return data;
}

/**
 * Retrieves the structured presentation JSON model for the current user.
 * @returns {Promise<{title: string, filename: string, slides: Array<any>}>}
 */
export async function getPresentation() {
  const response = await fetch(`${API_BASE_URL}/presentation`, {
    method: 'GET',
    headers: getAuthHeaders({
      'Accept': 'application/json',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Failed to load presentation (HTTP ${response.status})`);
  }

  return data;
}

/**
 * Saves user edits to the presentation model for the current user.
 * @param {object} presentationData
 * @returns {Promise<{status: string, message: string, slide_count: number, presentation: any}>}
 */
export async function savePresentation(presentationData) {
  const response = await fetch(`${API_BASE_URL}/presentation`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
    body: JSON.stringify(presentationData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Failed to save presentation (HTTP ${response.status})`);
  }

  return data;
}

/**
 * Generates the final PowerPoint (.pptx) file from the edited presentation model.
 * @param {object|null} presentationData
 * @returns {Promise<{status: string, message: string, filename: string, download_url: string, slide_count: number}>}
 */
export async function generatePptx(presentationData = null) {
  const options = {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
  };

  if (presentationData) {
    options.body = JSON.stringify(presentationData);
  }

  const response = await fetch(`${API_BASE_URL}/generate-presentation`, options);

  if (!response.ok) {
    let errMessage = `PowerPoint generation failed (HTTP ${response.status})`;
    try {
      const errData = await response.json();
      if (errData.detail) errMessage = errData.detail;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const blob = await response.blob();
  return { status: 'success', blob, filename: 'InsightDeck_Presentation.pptx' };
}

export const generatePresentation = generatePptx;

/**
 * Gets the direct download URL for the generated PowerPoint deck with auth token.
 * @returns {string}
 */
export function getPresentationDownloadUrl() {
  const token = getIdToken();
  return `${API_BASE_URL}/presentation/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

/**
 * Initiates direct browser download of the PowerPoint presentation file as real InsightDeck_Presentation.pptx.
 * @param {string} filename
 */
export async function downloadPresentationFile(filename = 'InsightDeck_Presentation.pptx') {
  const downloadUrl = getPresentationDownloadUrl();
  const response = await fetch(downloadUrl, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let errMessage = `Download failed (HTTP ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.detail) errMessage = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const rawBlob = await response.blob();
  const blob = new Blob([rawBlob], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1500);
}

export { API_BASE_URL };
