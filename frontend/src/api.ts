const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
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
  if (!res.ok) throw new Error('Login failed');
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
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function getAdminHierarchy(userId?: string) {
  const token = localStorage.getItem('token');
  const url = userId ? `${API_URL}/api/v1/admin/hierarchy/topics?user_id=${userId}` : `${API_URL}/api/v1/admin/hierarchy/topics`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

export async function generateFlashcards(topicId: string) {
  const res = await fetch(`${API_URL}/api/v1/admin/flashcards/generate/${topicId}`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Generation failed');
  return res.json();
}

export async function getUsers() {
  const res = await fetch(`${API_URL}/api/v1/admin/users`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Fetch users failed');
  return res.json();
}

export async function assignTopic(topicId: string, targetUserId: string) {
  const res = await fetch(`${API_URL}/api/v1/admin/assign?topic_id=${topicId}&target_user_id=${targetUserId}`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Assignment failed');
  return res.json();
}

export async function getQueue() {
  const res = await fetch(`${API_URL}/api/v1/employee/queue`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Fetch queue failed');
  return res.json();
}

export async function getEmployeeHierarchy() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/hierarchy/topics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Queue failed');
  return res.json();
}

export async function submitEvaluation(flashcardId: string, answer: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/evaluate`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ flashcard_id: flashcardId, user_answer: answer })
  });
  if (!res.ok) throw new Error('Evaluation failed');
  return res.json();
}

export async function getTopicCards(topicId: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/v1/employee/topic/${topicId}/cards`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch topic cards');
  return res.json();
}
