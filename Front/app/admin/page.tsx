"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { DappShell } from "@/components/dapp-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  adminClient,
  type AdminEvent,
  type AdminLender,
  type AdminPlatform,
} from "@/lib/admin-client"
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react"

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [adminKeyInput, setAdminKeyInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState<AdminPlatform[]>([])
  const [lenders, setLenders] = useState<AdminLender[]>([])
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [registerForm, setRegisterForm] = useState({
    platformId: "",
    name: "",
    webhookUrl: "",
  })
  const [lastRegisteredKey, setLastRegisteredKey] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [platformsRes, lendersRes, eventsRes, health] = await Promise.all([
      adminClient.listPlatforms(),
      adminClient.listLenders(),
      adminClient.listRecentEvents(50, 0),
      adminClient.getHealthReady(),
    ])

    setLoading(false)
    setHealthOk(health.ok)

    if (platformsRes.error || lendersRes.error || eventsRes.error) {
      setError(platformsRes.error ?? lendersRes.error ?? eventsRes.error ?? "Failed to load")
      if (platformsRes.statusCode === 403) {
        adminClient.clearAdminKey()
        setAuthenticated(false)
      }
      return
    }

    setPlatforms(platformsRes.data?.platforms ?? [])
    setLenders(lendersRes.data?.lenders ?? [])
    setEvents(eventsRes.data?.events ?? [])
  }, [])

  useEffect(() => {
    if (adminClient.isAuthenticated()) {
      setAuthenticated(true)
      loadDashboard()
    }
  }, [loadDashboard])

  const handleLogin = (event: FormEvent) => {
    event.preventDefault()
    adminClient.setAdminKey(adminKeyInput.trim())
    setAuthenticated(true)
    loadDashboard()
  }

  const handleRegisterPlatform = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setLastRegisteredKey(null)

    const result = await adminClient.registerPlatform({
      platformId: registerForm.platformId.trim(),
      name: registerForm.name.trim(),
      webhookUrl: registerForm.webhookUrl.trim() || undefined,
    })

    if (result.error) {
      setError(result.error)
      return
    }

    setLastRegisteredKey(result.data?.apiKey ?? null)
    setRegisterForm({ platformId: "", name: "", webhookUrl: "" })
    loadDashboard()
  }

  const handleDispute = async (event: AdminEvent) => {
    const reason = window.prompt("Reason for disputing this credit event?")?.trim()
    if (!reason) return

    setActionId(`dispute-${event.id}`)
    setError(null)
    setNotice(null)
    const result = await adminClient.disputeEvent(event.id, reason)
    setActionId(null)

    if (result.error) {
      setError(result.error)
      return
    }

    setNotice("Event disputed. Recalculate the wallet to apply the score change.")
    loadDashboard()
  }

  const handleReinstate = async (event: AdminEvent) => {
    setActionId(`reinstate-${event.id}`)
    setError(null)
    setNotice(null)
    const result = await adminClient.reinstateEvent(event.id)
    setActionId(null)

    if (result.error) {
      setError(result.error)
      return
    }

    setNotice("Event reinstated. Recalculate the wallet to apply the score change.")
    loadDashboard()
  }

  const handleRecalculate = async (event: AdminEvent) => {
    setActionId(`recalc-${event.id}`)
    setError(null)
    setNotice(null)
    const result = await adminClient.recalculateUser(event.walletAddress)
    setActionId(null)

    if (result.error) {
      setError(result.error)
      return
    }

    setNotice(
      `Recalculated ${event.walletAddress.slice(0, 8)}...: ${result.data?.previousScore} -> ${result.data?.score}`
    )
    loadDashboard()
  }

  if (!authenticated) {
    return (
      <DappShell withGrid={false}>
        <div className="min-h-screen flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-white/10 bg-black/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                ZCore Admin
              </CardTitle>
              <CardDescription>
                Enter the operator admin key. This page is not linked in public navigation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="password"
                  placeholder="ADMIN_SECRET"
                  value={adminKeyInput}
                  onChange={(event) => setAdminKeyInput(event.target.value)}
                  className="bg-black border-white/10"
                />
                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </DappShell>
    )
  }

  return (
    <DappShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <p className="section-label mb-2">Operator</p>
          <h1 className="page-title mb-2">Admin Dashboard</h1>
          <p className="page-subtitle">
            Manage platforms, lenders, and disputed credit events.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert className="border-white/10 bg-white/[0.03]">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>System Health</CardTitle>
              <CardDescription>API readiness probe</CardDescription>
            </div>
            {healthOk === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/30" />
            ) : healthOk ? (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-zk text-white/60">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Operational
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-zk text-white/40">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                Unavailable
              </div>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Register platform</CardTitle>
            <CardDescription>Create a partner platform and issue an API key</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegisterPlatform} className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="platform-id"
                value={registerForm.platformId}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, platformId: event.target.value }))
                }
                className="bg-black border-white/10"
              />
              <Input
                placeholder="Platform name"
                value={registerForm.name}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="bg-black border-white/10"
              />
              <Input
                placeholder="Webhook URL (optional)"
                value={registerForm.webhookUrl}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, webhookUrl: event.target.value }))
                }
                className="bg-black border-white/10"
              />
              <Button type="submit" className="md:col-span-3 w-full md:w-auto">
                Register platform
              </Button>
            </form>
            {lastRegisteredKey && (
              <div className="mt-4 border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-zk-wide text-white/30 mb-1">
                  New API key - save it now
                </p>
                <p className="text-xs font-mono text-white/70 break-all select-all">
                  {lastRegisteredKey}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Platforms ({platforms.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platforms.map((platform) => (
                      <TableRow key={platform.id} className="border-white/[0.06]">
                        <TableCell className="text-xs">{platform.id}</TableCell>
                        <TableCell className="text-xs">{platform.name}</TableCell>
                        <TableCell className="text-xs font-mono break-all">{platform.apiKey}</TableCell>
                        <TableCell className="text-xs">{platform.active ? "yes" : "no"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lenders ({lenders.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Profiles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lenders.map((lender) => (
                      <TableRow key={lender.id} className="border-white/[0.06]">
                        <TableCell className="text-xs">{lender.name}</TableCell>
                        <TableCell className="text-xs font-mono break-all">{lender.apiKey}</TableCell>
                        <TableCell className="text-xs">
                          {Array.isArray(lender.profiles) ? lender.profiles.length : 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent events ({events.length})</CardTitle>
                <CardDescription>
                  Dispute or reinstate an event, then recalculate that wallet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead>Date</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Impact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id} className="border-white/[0.06]">
                        <TableCell className="text-xs text-white/50">
                          {event.createdAt.split("T")[0]}
                        </TableCell>
                        <TableCell className="text-xs">{event.platformName}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {event.walletAddress.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-xs tabular-nums font-bold">
                          {event.scoreImpact > 0 ? "+" : ""}
                          {event.scoreImpact}
                        </TableCell>
                        <TableCell className="text-xs">
                          {event.disputed ? (
                            <span title={event.disputeReason ?? undefined}>disputed</span>
                          ) : (
                            "active"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {event.disputed ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionId === `reinstate-${event.id}`}
                                onClick={() => handleReinstate(event)}
                              >
                                Reinstate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionId === `dispute-${event.id}`}
                                onClick={() => handleDispute(event)}
                              >
                                Dispute
                              </Button>
                            )}
                            <Button
                              size="sm"
                              disabled={actionId === `recalc-${event.id}`}
                              onClick={() => handleRecalculate(event)}
                            >
                              Recalculate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DappShell>
  )
}
