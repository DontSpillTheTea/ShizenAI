const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
}

function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('name');
  localStorage.removeItem('role');
  window.dispatchEvent(new Event('shizen-auth-expired'));
}

async function ensureOk(res: Response, fallbackMessage: string) {
  if (res.ok) return;

  if (res.status === 401) {
    clearAuthSession();
    throw new Error('Session expired. Please sign in again.');
  }

  let message = fallbackMessage;
  try {
    const payload = await res.json();
    if (payload?.detail) {
      message = typeof payload.detail === 'string' ? payload.detail : fallbackMessage;
    }
  } catch {
    // Keep fallback message when response is not JSON.
  }

  throw new Error(message);
}

export async function login(username: string, password: string) {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  
  const res = await fetch(`${API_URL}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData
  });
  await ensureOk(res, 'Login failed');
  return res.json();
}

export async function uploadDocument(file: File, topicTitle: string, parentTopicId?: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('topic_title', topicTitle);
  if (parentTopicId) formData.append('parent_topic_id', parentTopicId);
  
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/admin/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  await ensureOk(res, 'Upload failed');
  return res.json();
}

export async function getAdminHierarchy(userId?: string) {
  const token = localStorage.getItem('token');
  const url = userId ? `${API_URL}/api/v1/admin/hierarchy/topics?user_id=${userId}` : `${API_URL}/api/v1/admin/hierarchy/topics`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  await ensureOk(res, 'Failed to fetch topics');
  return res.json();
}

export async function generateFlashcards(topicId: string) {
  const res = await fetch(`${API_URL}/api/v1/admin/flashcards/generate/${topicId}`, {
    method: 'POST',
    headers: getHeaders()
  });
  await ensureOk(res, 'Generation failed');
  return res.json();
}

export async function getUsers() {
  const res = await fetch(`${API_URL}/api/v1/admin/users`, { headers: getHeaders() });
  await ensureOk(res, 'Fetch users failed');
  return res.json();
}

export async function assignTopic(topicId: string, targetUserId: string) {
  const res = await fetch(`${API_URL}/api/v1/admin/assign?topic_id=${topicId}&target_user_id=${targetUserId}`, {
    method: 'POST',
    headers: getHeaders()
  });
  await ensureOk(res, 'Assignment failed');
  return res.json();
}

export async function getQueue() {
  const res = await fetch(`${API_URL}/api/v1/employee/queue`, { headers: getHeaders() });
  await ensureOk(res, 'Fetch queue failed');
  return res.json();
}

export async function getEmployeeHierarchy() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/hierarchy/topics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  await ensureOk(res, 'Failed to fetch employee hierarchy');
  return res.json();
}

export async function getTTSAudioBlob(text: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ text })
  });
  await ensureOk(res, 'TTS failed');
  return res.blob();
}

export async function submitEvaluation(flashcardId: string, messages: any[]) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/evaluate`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ flashcard_id: flashcardId, messages })
  });
  await ensureOk(res, 'Evaluation failed');
  return res.json();
}

export async function getTopicCards(topicId: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/topic/${topicId}/cards`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  await ensureOk(res, 'Failed to fetch topic cards');
  return res.json();
}

export async function markCardWrong(flashcardId: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/mark_wrong/${flashcardId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  await ensureOk(res, 'Failed to mark wrong');
  return res.json();
}

export async function createEmployee(name: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/admin/users`, {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ name })
  });
  await ensureOk(res, 'Failed to create new user');
  return res.json();
}

// ── Omi Integration ──────────────────────────────────────────────────────────

export async function importOmiText(
  title: string,
  text: string,
  topicPath?: string
): Promise<{ status: string; source_id: string }> {
  const res = await fetch(`${API_URL}/api/v1/integrations/omi/import-text`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title, text, topic_path: topicPath })
  });
  await ensureOk(res, 'Omi text import failed');
  return res.json();
}

export async function finalizeOmiImport(
  params: { source_id?: string; session_id?: string; topic_path?: string }
): Promise<{ status: string; source_id: string; topics_created: any[]; message: string }> {
  const res = await fetch(`${API_URL}/api/v1/integrations/omi/finalize`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params)
  });
  await ensureOk(res, 'Omi finalize failed');
  return res.json();
}

export async function getOmiCaptures(): Promise<any[]> {
  const res = await fetch(`${API_URL}/api/v1/integrations/omi/captures`, {
    headers: getHeaders()
  });
  await ensureOk(res, 'Failed to load Omi captures');
  return res.json();
}
