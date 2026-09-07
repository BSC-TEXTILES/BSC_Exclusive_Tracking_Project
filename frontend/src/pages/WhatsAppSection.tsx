import { useEffect, useState } from 'react'
import {
  MessageSquare, Send, Users, CheckCircle2,
  TrendingUp, Clock, Search, RefreshCw, ExternalLink, ShieldCheck,
  Building2, Phone, AlertCircle
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { get, post } from '../lib/api'
import { PageHeader, Spinner } from '../components/States'
import { fmtDateTime } from '../lib/format'

interface DashboardData {
  metrics: {
    total_customers: number
    total_bsc_users: number
    total_contacts: number
    total_messages: number
    delivered_count: number
    sent_count: number
    failed_count: number
    customer_messages_count: number
    bsc_user_messages_count: number
    deliveryRate: number
  }
  timeline: { label: string; count: number; delivered: number; customer_count: number; bsc_user_count: number }[]
  templateStats: { template_name: string; count: number }[]
  recentMessages: MessageItem[]
}

interface ContactItem {
  id: string
  name: string
  phone_number: string
  contact_type: 'CUSTOMER' | 'BSC_USER'
  is_active: boolean
  employee_code?: string
  customer_code?: string
  city?: string
  state?: string
}

interface MessageItem {
  id: string
  recipient_number: string
  recipient_name: string
  recipient_type: 'CUSTOMER' | 'BSC_USER'
  template_name: string
  message_content: string
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED'
  sent_by_name?: string
  created_at: string
  delivered_at?: string
}

export default function WhatsAppSection() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'compose' | 'history'>('dashboard')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [history, setHistory] = useState<MessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Filters
  const [contactSearch, setContactSearch] = useState('')
  const [contactTypeFilter, setContactTypeFilter] = useState('ALL')
  const [historySearch, setHistorySearch] = useState('')
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL')
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL')

  // Composer Form
  const [recipientName, setRecipientName] = useState('')
  const [recipientNumber, setRecipientNumber] = useState('')
  const [recipientType, setRecipientType] = useState<'CUSTOMER' | 'BSC_USER'>('CUSTOMER')
  const [selectedTemplate, setSelectedTemplate] = useState('Account Creation Welcome')
  const [messageContent, setMessageContent] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; waLink?: string } | null>(null)

  // Load Dashboard Data
  const loadDashboard = () => {
    setLoading(true)
    get<DashboardData>('/api/whatsapp/dashboard')
      .then(d => setDashboardData(d))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  // Load Contacts
  const loadContacts = () => {
    const q = new URLSearchParams()
    if (contactSearch) q.set('search', contactSearch)
    if (contactTypeFilter !== 'ALL') q.set('type', contactTypeFilter)
    get<{ contacts: ContactItem[] }>(`/api/whatsapp/contacts?${q.toString()}`)
      .then(d => setContacts(d.contacts))
      .catch(err => console.error(err))
  }

  // Load History
  const loadHistory = () => {
    const q = new URLSearchParams()
    if (historySearch) q.set('search', historySearch)
    if (historyTypeFilter !== 'ALL') q.set('recipientType', historyTypeFilter)
    if (historyStatusFilter !== 'ALL') q.set('status', historyStatusFilter)
    get<{ history: MessageItem[] }>(`/api/whatsapp/history?${q.toString()}`)
      .then(d => setHistory(d.history))
      .catch(err => console.error(err))
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (activeTab === 'contacts') loadContacts()
  }, [activeTab, contactSearch, contactTypeFilter])

  useEffect(() => {
    if (activeTab === 'history') loadHistory()
  }, [activeTab, historySearch, historyTypeFilter, historyStatusFilter])

  // Update Template Text when template changes
  useEffect(() => {
    const name = recipientName || '[Recipient Name]'
    const id = recipientType === 'CUSTOMER' ? 'CUST-1001' : 'BSC-001'
    const portalUrl = window.location.origin

    switch (selectedTemplate) {
      case 'Account Creation Welcome':
        setMessageContent(
          `Hello ${name},\n\nWelcome to BSC Exclusive Platform!\nYour account identifier is ${id}.\nYou can securely sign in or activate your portal profile at:\n${portalUrl}/login\n\nFor security reasons, your temporary password was communicated separately. Contact your administrator for assistance.`
        )
        break
      case 'Checkpoint Inspection Alert':
        setMessageContent(
          `Hello ${name},\n\nA checkpoint quality inspection has been completed and verified for your assigned process.\nStatus: APPROVED\nReview details on your BSC Exclusive portal: ${portalUrl}/checkpoints`
        )
        break
      case 'Furniture Order Status Update':
        setMessageContent(
          `Dear ${name},\n\nYour furniture order / PO specification is currently in the Quality Auditing phase.\nTrack real-time progress on BSC: ${portalUrl}`
        )
        break
      case 'System Announcement':
        setMessageContent(
          `BSC System Notice:\n\nPlease be advised that standard compliance reviews and data sync are scheduled. Ensure all open checkpoints are submitted by 18:00.`
        )
        break
      default:
        break
    }
  }, [selectedTemplate, recipientName, recipientType])

  const handleSelectContactForMessage = (c: ContactItem) => {
    setRecipientName(c.name)
    setRecipientNumber(c.phone_number)
    setRecipientType(c.contact_type)
    setActiveTab('compose')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipientNumber || !messageContent) return

    setBusy(true)
    setFeedback(null)
    try {
      const res = await post<{ success: boolean; waLink: string; message: string }>('/api/whatsapp/send', {
        recipientNumber,
        recipientName: recipientName || 'Recipient',
        recipientType,
        templateName: selectedTemplate,
        messageContent,
      })

      setFeedback({
        type: 'success',
        message: res.message,
        waLink: res.waLink,
      })
      loadDashboard()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: (err as Error).message,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp Communication Hub"
        subtitle="Centralized WhatsApp messaging, delivery analytics, and customer communication workflows"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === 'dashboard') loadDashboard()
                else if (activeTab === 'contacts') loadContacts()
                else if (activeTab === 'history') loadHistory()
              }}
              className="btn btn-ghost btn-sm"
              title="Refresh Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTab('compose')}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5" /> Send Message
            </button>
          </div>
        }
      />

      {/* Hub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> WhatsApp Dashboard
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'contacts' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Contacts Directory
        </button>
        <button
          onClick={() => setActiveTab('compose')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'compose' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Message Templates & Send
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'history' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Communication History
        </button>
      </div>

      {/* 1. DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div>
          {loading || !dashboardData ? (
            <Spinner />
          ) : (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="card p-3.5">
                  <p className="text-[11px] text-slate-500 font-medium">Total Customers</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{dashboardData.metrics.total_customers}</p>
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 mt-0.5">
                    <Building2 className="w-3 h-3" /> Registered
                  </span>
                </div>

                <div className="card p-3.5">
                  <p className="text-[11px] text-slate-500 font-medium">BSC Users</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{dashboardData.metrics.total_bsc_users}</p>
                  <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 mt-0.5">
                    <Users className="w-3 h-3" /> Team
                  </span>
                </div>

                <div className="card p-3.5">
                  <p className="text-[11px] text-slate-500 font-medium">WhatsApp Enabled</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{dashboardData.metrics.total_contacts}</p>
                  <span className="text-[10px] text-purple-600 font-medium flex items-center gap-0.5 mt-0.5">
                    <Phone className="w-3 h-3" /> Verified Contacts
                  </span>
                </div>

                <div className="card p-3.5">
                  <p className="text-[11px] text-slate-500 font-medium">Messages Sent</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{dashboardData.metrics.total_messages}</p>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    {dashboardData.metrics.customer_messages_count} to Customers
                  </span>
                </div>

                <div className="card p-3.5">
                  <p className="text-[11px] text-slate-500 font-medium">Delivery Rate</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">{dashboardData.metrics.deliveryRate}%</p>
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> {dashboardData.metrics.delivered_count} Delivered
                  </span>
                </div>

                <div className="card p-3.5">
                  <p className="text-[11px] text-slate-500 font-medium">Failed Dispatches</p>
                  <p className="text-xl font-bold text-rose-600 mt-1">{dashboardData.metrics.failed_count}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5">0 retry required</span>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 14-day Delivery Timeline */}
                <div className="card p-4 lg:col-span-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    14-Day Messaging Volume & Delivery Trend
                  </h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboardData.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '11px',
                            border: 'none',
                          }}
                        />
                        <Area type="monotone" dataKey="delivered" stroke="#10b981" fillOpacity={1} fill="url(#waGrad)" name="Delivered Messages" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Template Usage Distribution */}
                <div className="card p-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Template Usage
                  </h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.templateStats} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="template_name" tick={{ fontSize: 9 }} width={90} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '11px',
                            border: 'none',
                          }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Dispatched" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Activity Table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recent WhatsApp Dispatches
                  </h4>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    View all history &rarr;
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Type</th>
                        <th>Template</th>
                        <th>Message Preview</th>
                        <th>Status</th>
                        <th>Sent At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.recentMessages.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <p className="font-semibold text-xs text-slate-900">{m.recipient_name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{m.recipient_number}</p>
                          </td>
                          <td>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              m.recipient_type === 'CUSTOMER' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {m.recipient_type}
                            </span>
                          </td>
                          <td className="text-xs text-slate-600 font-medium">{m.template_name}</td>
                          <td className="text-xs text-slate-500 max-w-xs truncate">{m.message_content}</td>
                          <td>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {m.status}
                            </span>
                          </td>
                          <td className="text-xs text-slate-400">{fmtDateTime(m.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. CONTACTS DIRECTORY TAB */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-9 text-xs"
                placeholder="Search contact name, phone, code..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-44 text-xs"
              value={contactTypeFilter}
              onChange={(e) => setContactTypeFilter(e.target.value)}
            >
              <option value="ALL">All Contact Types</option>
              <option value="CUSTOMER">Customers Only</option>
              <option value="BSC_USER">BSC Users Only</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Contact Name</th>
                    <th>Type & ID</th>
                    <th>WhatsApp Phone</th>
                    <th>Location</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                        No contacts found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    contacts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <p className="font-semibold text-xs text-slate-900">{c.name}</p>
                        </td>
                        <td>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.contact_type === 'CUSTOMER' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {c.contact_type === 'CUSTOMER' ? 'Customer' : 'BSC User'}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 ml-2">
                            {c.customer_code || c.employee_code || '—'}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-700">{c.phone_number}</td>
                        <td className="text-xs text-slate-500">
                          {c.city ? `${c.city}, ${c.state || ''}` : '—'}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleSelectContactForMessage(c)}
                            className="btn btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Message
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPOSE & TEMPLATES TAB */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" /> Send WhatsApp Message
            </h3>

            {feedback && (
              <div className={`p-3.5 rounded-xl mb-4 text-xs font-medium flex items-center justify-between ${
                feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <span>{feedback.message}</span>
                {feedback.waLink && (
                  <a
                    href={feedback.waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                  >
                    Open in WhatsApp Web <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Recipient Type *</label>
                  <select
                    className="input text-xs"
                    value={recipientType}
                    onChange={(e) => setRecipientType(e.target.value as any)}
                  >
                    <option value="CUSTOMER">Customer Account</option>
                    <option value="BSC_USER">BSC Team Member</option>
                  </select>
                </div>

                <div>
                  <label className="label">Message Template</label>
                  <select
                    className="input text-xs font-semibold"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    <option value="Account Creation Welcome">Account Creation Welcome</option>
                    <option value="Checkpoint Inspection Alert">Checkpoint Inspection Alert</option>
                    <option value="Furniture Order Status Update">Furniture Order Status Update</option>
                    <option value="System Announcement">System Announcement</option>
                  </select>
                </div>

                <div>
                  <label className="label">Recipient Name *</label>
                  <input
                    className="input text-xs"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    required
                  />
                </div>

                <div>
                  <label className="label">WhatsApp Number (10 or 12 digits) *</label>
                  <input
                    className="input text-xs font-mono"
                    value={recipientNumber}
                    onChange={(e) => setRecipientNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Message Content *</label>
                <textarea
                  className="input min-h-[140px] text-xs font-sans leading-relaxed"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  required
                />
              </div>

              {/* Security Rule Alert */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Security Compliance Mandate</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Account credentials sent over WhatsApp must never contain plain-text passwords. Only username, User/Customer ID, and activation portal links are permitted.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy || !recipientNumber}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Dispatch WhatsApp Message
                </button>

                {recipientNumber && (
                  <a
                    href={`https://wa.me/${recipientNumber.length === 10 ? '91' + recipientNumber : recipientNumber}?text=${encodeURIComponent(messageContent)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost text-emerald-700 border border-emerald-300 hover:bg-emerald-50 inline-flex items-center gap-1.5"
                  >
                    Preview in WhatsApp Web <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </form>
          </div>

          {/* WhatsApp Preview Bubble */}
          <div className="card p-6 bg-slate-900 text-white flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
                Live WhatsApp Preview
              </p>
              <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-800/50 text-emerald-100 text-xs whitespace-pre-wrap leading-relaxed shadow-inner font-sans">
                {messageContent || 'Message preview will appear here...'}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p>• Recipient: {recipientName || 'Unspecified'} ({recipientNumber || 'No phone'})</p>
              <p>• Template: {selectedTemplate}</p>
              <p>• Logged in enterprise audit trail automatically</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. COMMUNICATION HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-9 text-xs"
                placeholder="Search history by recipient name, phone, message..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <select
              className="input w-40 text-xs"
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
            >
              <option value="ALL">All Recipients</option>
              <option value="CUSTOMER">Customers</option>
              <option value="BSC_USER">BSC Users</option>
            </select>
            <select
              className="input w-36 text-xs"
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Type</th>
                    <th>Template</th>
                    <th>Message Details</th>
                    <th>Delivery Status</th>
                    <th>Sent By</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                        No communication history found matching filters.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <p className="font-semibold text-xs text-slate-900">{h.recipient_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{h.recipient_number}</p>
                        </td>
                        <td>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            h.recipient_type === 'CUSTOMER' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {h.recipient_type}
                          </span>
                        </td>
                        <td className="text-xs text-slate-600 font-medium">{h.template_name}</td>
                        <td className="text-xs text-slate-600 max-w-sm">
                          <p className="line-clamp-2">{h.message_content}</p>
                        </td>
                        <td>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                            h.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" /> {h.status}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500">{h.sent_by_name || 'System'}</td>
                        <td className="text-xs text-slate-400">{fmtDateTime(h.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
