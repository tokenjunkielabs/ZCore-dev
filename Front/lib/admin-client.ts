const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000"

export interface AdminPlatform {
  id: string
  name: string
  apiKey: string
  webhookUrl: string | null
  active: boolean
  createdAt: string
}

export interface AdminLender {
  id: string
  name: string
  apiKey: string
  profiles: unknown
  createdAt: string
  updatedAt: string
}

export interface AdminEvent {
  id: string
  platformId: string
  platformName: string
  walletAddress: string
  eventType: string
  amount: number
  currency: string
  scoreImpact: number
  txHash: string
  createdAt: string
  disputed: boolean
  disputeReason: string | null
  disputedAt: string | null
  disputedBy: string | null
}

export interface AdminRecalcResult {
  walletAddress: string
  previousScore: number
  score: number
  profileTier: string
  stellarBase: number
  eventsTotal: number
  paymentsTotal: number
}

class AdminClient {
  private getAdminKey(): string | null {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("zcore_admin_key")
  }

  setAdminKey(key: string) {
    sessionStorage.setItem("zcore_admin_key", key)
  }

  clearAdminKey() {
    sessionStorage.removeItem("zcore_admin_key")
  }

  isAuthenticated(): boolean {
    return Boolean(this.getAdminKey())
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string; statusCode?: number }> {
    const adminKey = this.getAdminKey()
    if (!adminKey) {
      return { error: "Admin key required", statusCode: 401 }
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
          ...(options.headers ?? {}),
        },
      })

      const body = await response.json()

      if (!response.ok) {
        return {
          error: body.error ?? "Request failed",
          statusCode: response.status,
        }
      }

      return { data: body.data as T }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Network error",
        statusCode: 0,
      }
    }
  }

  listPlatforms() {
    return this.request<{ platforms: AdminPlatform[] }>("/api/admin/platforms")
  }

  listLenders() {
    return this.request<{ lenders: AdminLender[] }>("/api/admin/lenders")
  }

  listRecentEvents(limit = 50, offset = 0) {
    return this.request<{
      events: AdminEvent[]
      pagination: { limit: number; offset: number; total: number }
    }>(`/api/admin/events/recent?limit=${limit}&offset=${offset}`)
  }

  disputeEvent(id: string, reason: string) {
    return this.request<{ event: AdminEvent }>(
      `/api/admin/events/${encodeURIComponent(id)}/dispute`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      }
    )
  }

  reinstateEvent(id: string) {
    return this.request<{ event: AdminEvent }>(
      `/api/admin/events/${encodeURIComponent(id)}/reinstate`,
      { method: "POST" }
    )
  }

  recalculateUser(wallet: string) {
    return this.request<AdminRecalcResult>(
      `/api/admin/users/${encodeURIComponent(wallet)}/recalculate`,
      { method: "POST" }
    )
  }

  registerPlatform(payload: {
    platformId: string
    name: string
    webhookUrl?: string
  }) {
    const adminKey = this.getAdminKey()
    return this.request<{ platformId: string; apiKey: string; webhookSecret?: string }>(
      "/api/platforms/register",
      {
        method: "POST",
        body: JSON.stringify({ adminKey, ...payload }),
      }
    )
  }

  async getHealthReady(): Promise<{ ok: boolean; status?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/health/ready`)
      const body = await response.json()
      return { ok: response.ok, status: body.status }
    } catch {
      return { ok: false }
    }
  }
}

export const adminClient = new AdminClient()
