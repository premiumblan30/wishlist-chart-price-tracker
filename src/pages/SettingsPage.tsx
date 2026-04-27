import { Layout } from '@/components/layout/Layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { User, Bell, ShieldAlert, Mail, TrendingDown, Target } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function SettingsPage() {
  const { user } = useAuth()
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [alertOnDrop, setAlertOnDrop] = useState(true)
  const [alertOnTarget, setAlertOnTarget] = useState(true)
  const [dropThreshold, setDropThreshold] = useState(5)
  const [loading, setLoading] = useState(false)

  // Load existing settings on mount
  useEffect(() => {
    async function loadAlertSettings() {
      if (!user) return
      const { data, error } = await supabase
        .from('alert_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data && !error) {
        setEmailEnabled(data.email_enabled ?? true)
        setAlertOnDrop(data.alert_on_drop ?? true)
        setAlertOnTarget(data.alert_on_target ?? true)
        setDropThreshold(data.drop_threshold ?? 5)
      }
    }
    loadAlertSettings()
  }, [user])

  async function handleSave() {
    setLoading(true)
    try {
      // Validate drop threshold
      if (dropThreshold < 1 || dropThreshold > 100) {
        toast.error('Persen penurunan minimum harus antara 1% dan 100%')
        setLoading(false)
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        toast.error('User not authenticated')
        return
      }

      const { error } = await supabase
        .from('alert_settings')
        .upsert({
          user_id: authUser.id,
          email_enabled: emailEnabled,
          alert_on_drop: alertOnDrop,
          alert_on_target: alertOnTarget,
          drop_threshold: dropThreshold,
        }, { onConflict: 'user_id' })

      if (error) throw error
      toast.success('Pengaturan berhasil disimpan')
    } catch (err) {
      console.error('Failed to save alert settings:', err)
      toast.error('Failed to save alert settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Settings">
      <div className="space-y-6">
        {/* User Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <input
                id="email"
                type="email"
                value={user?.email || ''}
                readOnly
                className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Your email is used for authentication and cannot be changed.
            </p>
          </CardContent>
        </Card>

        {/* Notification Preferences Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Manage how you receive price drop alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email notifikasi aktif</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={emailEnabled}
                onCheckedChange={setEmailEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notifikasi saat harga turun</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when price drops
                  </p>
                </div>
              </div>
              <Switch
                checked={alertOnDrop}
                onCheckedChange={setAlertOnDrop}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notifikasi saat harga hit target</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when target price is reached
                  </p>
                </div>
              </div>
              <Switch
                checked={alertOnTarget}
                onCheckedChange={setAlertOnTarget}
              />
            </div>
            <div className="space-y-2 pt-2">
              <Label htmlFor="dropThreshold">Persen penurunan minimum</Label>
              <Input
                id="dropThreshold"
                type="number"
                min="1"
                max="100"
                value={dropThreshold}
                onChange={(e) => setDropThreshold(Number(e.target.value))}
                className="w-full max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                Minimum percentage drop to trigger notification (default 5%)
              </p>
            </div>
            <div className="pt-4">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Alert Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone Section */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible actions for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button variant="destructive" disabled>
                Delete Account
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Account deletion is disabled for now.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
