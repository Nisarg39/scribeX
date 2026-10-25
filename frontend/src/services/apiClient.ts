/**
 * Authenticated API Client for ScribeX Backend Services.
 *
 * Automatically injects authorization bearer tokens and tenant identifiers.
 */

import { appConfig } from '../core/config';
import { loadSession } from '../auth/sessionStorage';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = appConfig.apiUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const session = await loadSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (session?.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
    }
    if (session?.user?.id) {
      headers['X-User-ID'] = session.user.id;
    }

    return headers;
  }

  public async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const authHeaders = await this.getAuthHeaders();
    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (options.params) {
      const query = new URLSearchParams();
      Object.entries(options.params).forEach(([k, v]) => query.append(k, String(v)));
      url += `?${query.toString()}`;
    }

    const response = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        ...authHeaders,
        ...(options.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  public async post<T>(
    endpoint: string,
    body: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const authHeaders = await this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const response = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        ...authHeaders,
        ...(options.headers as Record<string, string>),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
