export interface User {
  id: string;
  email: string;
  is_admin: boolean;
  credits: number;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'excel' | 'image' | 'json' | 'chat-mention';
  data?: string;
}

export interface ToolCall {
  name: string;
  arg: string;
  status: 'running' | 'done' | 'error';
  title?: string;
  domain?: string;
}

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  created_at: string;
  attachments?: Attachment[];
  tool_calls?: ToolCall[];
}

export interface GetChatResponse extends Chat {
  messages: Message[];
}

export interface AuthResponse {
  token: string;
  user_id: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
}

export interface AdminUser {
  id: string;
  email: string;
  admin: boolean;
  created_at: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
}

// Common headers helper
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('bloom_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Fetch wrapper helper
async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  const authHdrs = getAuthHeaders();
  for (const [key, value] of Object.entries(authHdrs)) {
    headers.set(key, value);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.error) {
        errMsg = errBody.error;
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth API
  async register(email: string, password: string): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async verify(email: string, code: string): Promise<AuthResponse> {
    const res = await apiFetch<AuthResponse>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    localStorage.setItem('bloom_token', res.token);
    localStorage.setItem('bloom_user_id', res.user_id);
    return res;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('bloom_token', res.token);
    localStorage.setItem('bloom_user_id', res.user_id);
    return res;
  },

  async logout(): Promise<{ message: string }> {
    const res = await apiFetch<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
    localStorage.removeItem('bloom_token');
    localStorage.removeItem('bloom_user_id');
    return res;
  },

  async me(): Promise<User> {
    return apiFetch<User>('/api/auth/me');
  },

  async getCredits(): Promise<{ credits: number }> {
    return apiFetch<{ credits: number }>('/api/auth/credits');
  },

  // Chats API
  async listChats(): Promise<Chat[]> {
    return apiFetch<Chat[]>('/api/chats');
  },

  async createChat(title: string, model: string): Promise<Chat> {
    return apiFetch<Chat>('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ title, model }),
    });
  },

  async getChat(id: string): Promise<GetChatResponse> {
    return apiFetch<GetChatResponse>(`/api/chats/${id}`);
  },

  async deleteChat(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/chats/${id}`, {
      method: 'DELETE',
    });
  },

  // Admin API
  async adminListUsers(): Promise<AdminUser[]> {
    return apiFetch<AdminUser[]>('/api/admin/users');
  },

  async adminToggleAdmin(userId: string, admin: boolean): Promise<{ user_id: string; admin: boolean }> {
    return apiFetch<{ user_id: string; admin: boolean }>(`/api/admin/users/${userId}/admin`, {
      method: 'POST',
      body: JSON.stringify({ admin }),
    });
  },

  async adminDeleteUser(userId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Presets API
  async listPresets(): Promise<Preset[]> {
    return apiFetch<Preset[]>('/api/presets');
  },
};
