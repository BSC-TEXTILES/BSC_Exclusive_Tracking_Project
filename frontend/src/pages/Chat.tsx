import { useEffect, useState, useRef, useCallback } from 'react'
import {
  MessageSquare,
  Search,
  Send,
  Plus,
  Users,
  X,
  Check,
  CheckCheck,
  ArrowLeft,
  Trash2,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MapPin,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Info,
  Navigation,
  Play,
  Pause,
  ExternalLink,
  Shield,
  Radio,
  BarChart3,
  Download,
  HardDrive,
  Database,
  Calendar,
  TrendingUp,
  Activity,
  Loader2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import { useAuth } from '../lib/auth'
import { get, post, del } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useSocket } from '../lib/useSocket'
import { useTracking } from '../lib/tracking'
import { callSounds } from '../lib/callSounds'

interface ChatAnalytics {
  totals: {
    total_messages: number
    total_conversations: number
    total_members: number
  }
  volumeTrend: { date: string; label: string; count: number }[]
  typeDistribution: { type: string; count: number }[]
  roleDistribution: { role_name: string; count: number }[]
  callStats: { call_type: string; status: string; count: number; total_duration: number }[]
  storageStats: {
    oldest_at: string | null
    newest_at: string | null
    total_characters: number
  }
}

interface RoleItem {
  id: string
  name: string
  description: string
  user_count: number
}

export interface ChatContact {
  id: string
  fullName: string
  username: string
  email?: string
  phone: string | null
  employeeCode?: string
  profileImage?: string | null
  roleName: string
  roleDescription?: string
  departmentName?: string | null
  status?: string
}

interface Conversation {
  id: string
  title: string
  isGroup: boolean
  lastMessage: string | null
  lastMessageType: string
  lastMessageAt: string | null
  unreadCount: number
  members: ChatContact[]
  otherUser?: ChatContact | null
  createdAt: string
}

interface Message {
  id: string
  senderId: string
  senderName: string
  senderUsername: string
  senderPhone: string | null
  senderImage: string | null
  senderRole: string
  content: string
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO' | 'LOCATION' | 'CALL' | 'DOCUMENT'
  isEdited: boolean
  isDeleted: boolean
  createdAt: string
}

interface CallLog {
  id: string
  isOutgoing: boolean
  callType: 'AUDIO' | 'VIDEO'
  status: 'COMPLETED' | 'MISSED' | 'REJECTED'
  duration: number
  startedAt: string
  endedAt: string | null
  otherUser: {
    id: string
    fullName: string
    username: string
    phone: string | null
    image: string | null
    roleName: string
  }
}

interface ActiveCall {
  targetUser: {
    id: string
    fullName: string
    username: string
    phone: string | null
    roleName: string
  }
  callType: 'AUDIO' | 'VIDEO'
  isOutgoing: boolean
  status: 'calling' | 'ringing' | 'connected' | 'ended'
  startedAt?: number
  duration: number
}

interface IncomingCall {
  callerId: string
  callerName: string
  callerUsername: string
  callerPhone: string | null
  callerRole: string
  conversationId?: string
  callType: 'AUDIO' | 'VIDEO'
}

export default function Chat() {
  const { user } = useAuth()
  const { socket, sendMessage, joinChat, leaveChat, sendTyping, stopTyping, initiateCall, acceptCall, rejectCall, endCall } = useSocket()
  const { currentPosition, syncNow, pingCount } = useTracking()

  // Navigation sidebar tab: 'chats' | 'contacts' | 'calls' | 'analytics'
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'calls' | 'analytics'>('chats')

  // Analytics & Complete Data Storage
  const [analytics, setAnalytics] = useState<ChatAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const res = await get<{ success: boolean; data: ChatAnalytics }>('/api/chat/analytics')
      if (res.success) setAnalytics(res.data)
    } catch (err) {
      console.error('[chat] analytics error:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  const handleExportChats = async () => {
    setExporting(true)
    try {
      const res = await get<{ success: boolean; count: number; data: any[] }>('/api/chat/export')
      if (res.success) {
        const jsonStr = JSON.stringify(res.data, null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bsc_chat_archive_${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      alert('Failed to export chats: ' + (err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  // Conversations & Messages
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [msgSearchQuery, setMsgSearchQuery] = useState('')
  const [showMsgSearch, setShowMsgSearch] = useState(false)

  // Roles & Contacts
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('ALL')
  const [allUsers, setAllUsers] = useState<ChatContact[]>([])
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [showNewChat, setShowNewChat] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')

  // Contact Info Drawer & Modals
  const [inspectUser, setInspectUser] = useState<ChatContact | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState<string | null>(null)

  // Audio Voice Note Recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<any>(null)

  // Audio Player State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  // Calling States
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [callMuted, setCallMuted] = useState(false)
  const [callVideoOff, setCallVideoOff] = useState(false)
  const [callLogs, setCallLogs] = useState<CallLog[]>([])

  // WebRTC / Media Streams
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const callDurationIntervalRef = useRef<any>(null)

  // Layout & UI
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isMobileView, setIsMobileView] = useState(false)
  const typingTimeoutRef = useRef<any>(null)

  // Check mobile screen
  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Load Roles & Contacts ──────────────────────────────────
  const loadRolesAndUsers = useCallback(async () => {
    try {
      const [rolesRes, usersRes] = await Promise.all([
        get<{ data: RoleItem[] }>('/api/chat/roles'),
        get<{ data: any[] }>('/api/chat/users'),
      ])
      setRoles(rolesRes.data || [])

      const normalized: ChatContact[] = (usersRes.data || []).map((u: any) => ({
        id: u.id || u.userId,
        fullName: u.full_name || u.fullName,
        username: u.username,
        email: u.email,
        phone: u.phone || null,
        employeeCode: u.employee_code || u.employeeCode,
        profileImage: u.profile_image || u.profileImage,
        roleName: u.role_name || u.roleName,
        roleDescription: u.role_description,
        departmentName: u.department_name || u.departmentName,
        status: u.status,
      }))
      setAllUsers(normalized)
    } catch (err) {
      console.error('[chat] error loading roles/users:', err)
    }
  }, [])

  useEffect(() => {
    void loadRolesAndUsers()
  }, [loadRolesAndUsers])

  // ── Load Conversations ─────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const data = await get<{ data: any[] }>('/api/chat')
      const normalizedConv: Conversation[] = (data.data || []).map((c: any) => {
        const members: ChatContact[] = (c.members || []).map((m: any) => ({
          id: m.userId || m.id,
          fullName: m.fullName || m.full_name,
          username: m.username,
          phone: m.phone || null,
          email: m.email,
          employeeCode: m.employeeCode || m.employee_code,
          profileImage: m.profileImage || m.profile_image,
          roleName: m.roleName || m.role_name,
          departmentName: m.departmentName || m.department_name,
        }))
        const other = c.otherUser
          ? {
              id: c.otherUser.userId || c.otherUser.id,
              fullName: c.otherUser.fullName || c.otherUser.full_name,
              username: c.otherUser.username,
              phone: c.otherUser.phone || null,
              email: c.otherUser.email,
              employeeCode: c.otherUser.employeeCode || c.otherUser.employee_code,
              profileImage: c.otherUser.profileImage || c.otherUser.profile_image,
              roleName: c.otherUser.roleName || c.otherUser.role_name,
              departmentName: c.otherUser.departmentName || c.otherUser.department_name,
            }
          : null

        return {
          id: c.id,
          title: c.title,
          isGroup: c.isGroup,
          lastMessage: c.lastMessage,
          lastMessageType: c.lastMessageType || 'TEXT',
          lastMessageAt: c.lastMessageAt,
          unreadCount: c.unreadCount || 0,
          members,
          otherUser: other,
          createdAt: c.createdAt,
        }
      })
      setConversations(normalizedConv)
    } catch {
      // silent
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  // ── Load Call History ──────────────────────────────────────
  const loadCallLogs = useCallback(async () => {
    try {
      const data = await get<{ data: CallLog[] }>('/api/chat/calls')
      setCallLogs(data.data || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'calls') void loadCallLogs()
  }, [activeTab, loadCallLogs])

  // ── Load Messages ──────────────────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const data = await get<{ data: Message[] }>(`/api/chat/${convId}/messages`)
      setMessages(data.data || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    if (activeConvId) {
      void loadMessages(activeConvId)
      joinChat(activeConvId)
      return () => {
        leaveChat(activeConvId)
      }
    }
  }, [activeConvId, loadMessages, joinChat, leaveChat])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partnerTyping])

  // ── WebSocket Event Handlers ───────────────────────────────
  useEffect(() => {
    if (!socket) return

    const handleMessage = (data: { conversationId: string; message: Message }) => {
      if (data.conversationId === activeConvId) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
      if (data.message.senderId !== user?.id) {
        callSounds.playMessagePop()
      }
      void loadConversations()
    }

    const handleTyping = (data: { conversationId: string; userName: string; username: string }) => {
      if (data.conversationId === activeConvId) {
        setPartnerTyping(`@${data.username} is typing...`)
      }
    }

    const handleStopTyping = (data: { conversationId: string }) => {
      if (data.conversationId === activeConvId) {
        setPartnerTyping(null)
      }
    }

    const handleOnlineList = (ids: string[]) => {
      setOnlineUserIds(ids)
    }

    const handleUserOnline = (data: { userId: string }) => {
      setOnlineUserIds(prev => Array.from(new Set([...prev, data.userId])))
    }

    const handleUserOffline = (data: { userId: string }) => {
      setOnlineUserIds(prev => prev.filter(id => id !== data.userId))
    }

    const handleIncomingCall = (data: IncomingCall) => {
      setIncomingCall(data)
      callSounds.startIncomingRingtone()
    }

    const handleCallAccepted = (_data: any) => {
      callSounds.stop()
      setActiveCall(prev => {
        if (!prev) return null
        return { ...prev, status: 'connected', startedAt: Date.now() }
      })
      if (callDurationIntervalRef.current) clearInterval(callDurationIntervalRef.current)
      callDurationIntervalRef.current = setInterval(() => {
        setActiveCall(p => (p && p.status === 'connected' ? { ...p, duration: p.duration + 1 } : p))
      }, 1000)
    }

    const handleCallRejected = (_data: any) => {
      callSounds.stop()
      callSounds.playEndCallBeep()
      setActiveCall(prev => (prev ? { ...prev, status: 'ended' } : null))
      setTimeout(() => {
        terminateCallCleanup()
      }, 1500)
    }

    const handleCallEnded = (_data: any) => {
      callSounds.stop()
      callSounds.playEndCallBeep()
      setActiveCall(prev => (prev ? { ...prev, status: 'ended' } : null))
      setTimeout(() => {
        terminateCallCleanup()
      }, 1500)
    }

    socket.on('chat:message', handleMessage)
    socket.on('chat:typing', handleTyping)
    socket.on('chat:stop-typing', handleStopTyping)
    socket.on('users:online', handleOnlineList)
    socket.on('user:online', handleUserOnline)
    socket.on('user:offline', handleUserOffline)
    socket.on('call:incoming', handleIncomingCall)
    socket.on('call:accepted', handleCallAccepted)
    socket.on('call:rejected', handleCallRejected)
    socket.on('call:ended', handleCallEnded)

    return () => {
      socket.off('chat:message', handleMessage)
      socket.off('chat:typing', handleTyping)
      socket.off('chat:stop-typing', handleStopTyping)
      socket.off('users:online', handleOnlineList)
      socket.off('user:online', handleUserOnline)
      socket.off('user:offline', handleUserOffline)
      socket.off('call:incoming', handleIncomingCall)
      socket.off('call:accepted', handleCallAccepted)
      socket.off('call:rejected', handleCallRejected)
      socket.off('call:ended', handleCallEnded)
    }
  }, [socket, activeConvId, user?.id, loadConversations])

  // ── Send Message ───────────────────────────────────────────
  const handleSendMessage = async (contentToSend?: string, msgType: Message['messageType'] = 'TEXT') => {
    const text = (contentToSend ?? newMessage).trim()
    if (!text || !activeConvId || sending) return

    if (!contentToSend) setNewMessage('')
    setSending(true)
    setShowAttachMenu(false)
    setShowEmojiPicker(false)

    try {
      const data = await post<{ data: Message }>(`/api/chat/${activeConvId}/messages`, {
        content: text,
        messageType: msgType,
      })
      setMessages(prev => [...prev, data.data])
      sendMessage(activeConvId, text, msgType)
      void loadConversations()
    } catch {
      if (!contentToSend) setNewMessage(text)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value)
    if (!activeConvId) return

    sendTyping(activeConvId)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConvId)
    }, 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  // ── Start / Open Chat With User ────────────────────────────
  const startChatWithUser = async (targetUser: ChatContact) => {
    try {
      const res = await post<{ data: { id: string } }>('/api/chat', {
        isGroup: false,
        memberIds: [targetUser.id],
      })
      setActiveConvId(res.data.id)
      setActiveTab('chats')
      setShowNewChat(false)
      void loadConversations()
    } catch (err) {
      console.error('[chat] start chat error:', err)
    }
  }

  // ── Create Group Chat ──────────────────────────────────────
  const createGroupChat = async () => {
    if (selectedMembers.length === 0) return
    try {
      const res = await post<{ data: { id: string } }>('/api/chat', {
        title: groupName.trim() || 'BSC Group',
        isGroup: true,
        memberIds: selectedMembers,
      })
      setActiveConvId(res.data.id)
      setShowNewChat(false)
      setSelectedMembers([])
      setGroupName('')
      setActiveTab('chats')
      void loadConversations()
    } catch (err) {
      console.error('[chat] create group error:', err)
    }
  }

  // ── Voice Note Recording ───────────────────────────────────
  const startRecordingVoiceNote = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Microphone not supported on this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        if (audioChunksRef.current.length === 0) return
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = () => {
          const base64data = reader.result as string
          void handleSendMessage(base64data, 'AUDIO')
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1)
      }, 1000)
    } catch (err) {
      alert('Microphone permission denied or unavailable.')
    }
  }

  const stopRecordingVoiceNote = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(recordingTimerRef.current)
    }
  }

  const cancelRecordingVoiceNote = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = []
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(recordingTimerRef.current)
      setRecordingDuration(0)
    }
  }

  const togglePlayAudio = (id: string, audioSrc: string) => {
    if (playingAudioId === id) {
      audioPlayerRef.current?.pause()
      setPlayingAudioId(null)
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
      const audio = new Audio(audioSrc)
      audioPlayerRef.current = audio
      audio.play()
      setPlayingAudioId(id)
      audio.onended = () => setPlayingAudioId(null)
    }
  }

  // ── Share Live GPS Location ────────────────────────────────
  const shareLiveLocation = async () => {
    setShowAttachMenu(false)
    await syncNow()
    if (!currentPosition) {
      alert('Could not determine current location. Please ensure location is enabled.')
      return
    }
    const locPayload = JSON.stringify({
      latitude: currentPosition.latitude,
      longitude: currentPosition.longitude,
      accuracy: currentPosition.accuracy,
      timestamp: new Date().toISOString(),
      mapUrl: `https://www.google.com/maps?q=${currentPosition.latitude},${currentPosition.longitude}`,
    })
    void handleSendMessage(locPayload, 'LOCATION')
  }

  // ── Image Upload ───────────────────────────────────────────
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAttachMenu(false)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      void handleSendMessage(result, 'IMAGE')
    }
    reader.readAsDataURL(file)
  }

  // ── Delete Message ─────────────────────────────────────────
  const deleteMessage = async (messageId: string) => {
    if (!activeConvId) return
    try {
      await del(`/api/chat/${activeConvId}/messages/${messageId}`)
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m)))
    } catch {
      // silent
    }
  }

  // ── Calling Engine ─────────────────────────────────────────
  const startCall = async (
    targetUser: { id: string; fullName: string; username: string; phone: string | null; roleName: string },
    callType: 'AUDIO' | 'VIDEO'
  ) => {
    callSounds.startOutgoingRinging()
    setActiveCall({
      targetUser,
      callType,
      isOutgoing: true,
      status: 'ringing',
      duration: 0,
    })

    if (callType === 'VIDEO' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch {
        // ignore
      }
    }

    initiateCall(targetUser.id, activeConvId || undefined, callType)
  }

  const answerIncomingCall = async () => {
    if (!incomingCall) return
    callSounds.stop()

    if (incomingCall.callType === 'VIDEO' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch {
        // ignore
      }
    }

    acceptCall(incomingCall.callerId, incomingCall.callType)
    setActiveCall({
      targetUser: {
        id: incomingCall.callerId,
        fullName: incomingCall.callerName,
        username: incomingCall.callerUsername,
        phone: incomingCall.callerPhone,
        roleName: incomingCall.callerRole,
      },
      callType: incomingCall.callType,
      isOutgoing: false,
      status: 'connected',
      startedAt: Date.now(),
      duration: 0,
    })
    setIncomingCall(null)

    if (callDurationIntervalRef.current) clearInterval(callDurationIntervalRef.current)
    callDurationIntervalRef.current = setInterval(() => {
      setActiveCall(p => (p && p.status === 'connected' ? { ...p, duration: p.duration + 1 } : p))
    }, 1000)
  }

  const declineIncomingCall = () => {
    if (!incomingCall) return
    callSounds.stop()
    rejectCall(incomingCall.callerId, 'declined')
    void post('/api/chat/calls', {
      receiverId: user?.id,
      callType: incomingCall.callType,
      status: 'MISSED',
      duration: 0,
    })
    setIncomingCall(null)
    void loadCallLogs()
  }

  const hangUpCall = () => {
    if (!activeCall) return
    callSounds.stop()
    callSounds.playEndCallBeep()

    endCall(activeCall.targetUser.id, activeCall.duration)

    void post('/api/chat/calls', {
      receiverId: activeCall.targetUser.id,
      callType: activeCall.callType,
      status: activeCall.duration > 0 ? 'COMPLETED' : 'MISSED',
      duration: activeCall.duration,
    })

    terminateCallCleanup()
    void loadCallLogs()
  }

  const terminateCallCleanup = () => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current)
      callDurationIntervalRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    setActiveCall(null)
  }

  const activeConv = conversations.find(c => c.id === activeConvId)

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const title = c.isGroup ? c.title : c.otherUser?.fullName || c.title || 'Chat'
    const username = c.otherUser?.username || ''
    return title.toLowerCase().includes(searchQuery.toLowerCase()) || username.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Filter contacts by Role & Search
  const filteredUsers = allUsers.filter(u => {
    const matchesRole = selectedRole === 'ALL' || u.roleName === selectedRole
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery)) ||
      (u.employeeCode && u.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesRole && matchesSearch
  })

  // Filter messages in current chat
  const filteredMessages = messages.filter(m => {
    if (!msgSearchQuery.trim()) return true
    return m.content.toLowerCase().includes(msgSearchQuery.toLowerCase())
  })

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const s = sec % 60
    return `${mins}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden relative font-sans select-none">

      {/* ── LEFT SIDEBAR: WhatsApp Green Header + Tabs ───────── */}
      <div
        className={`w-full md:w-96 lg:w-[410px] bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 ${
          activeConvId && isMobileView ? 'hidden' : 'flex'
        }`}
      >
        {/* Top App Header */}
        <div className="px-4 py-3 bg-emerald-800 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs shadow-inner">
              {user?.fullName ? getInitials(user.fullName) : 'ME'}
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                BSC WhatsApp
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 font-mono">LIVE</span>
              </h1>
              <p className="text-[10px] text-emerald-200">@{user?.username} · {user?.roleName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewChat(true)}
              className="p-1.5 rounded-lg hover:bg-emerald-700/60 text-white transition-colors"
              title="New Conversation or Group"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live GPS Tracking Indicator Bar */}
        <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span className="font-medium">Continuous Live GPS:</span>
            <span className="text-slate-300 font-mono">
              {currentPosition ? `${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}` : 'Tracking...'}
            </span>
          </div>
          <button
            onClick={() => void syncNow()}
            className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-900 transition-colors flex items-center gap-1"
            title="Force immediate GPS ping"
          >
            <Navigation className="w-2.5 h-2.5" />
            Ping ({pingCount})
          </button>
        </div>

        {/* WhatsApp Three Primary Navigation Tabs */}
        <div className="flex bg-slate-900 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'chats'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chats</span>
            {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
                {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'contacts'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Roles & Users</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {allUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'calls'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Calls</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('analytics')
              void loadAnalytics()
            }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Charts</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-2.5 bg-slate-950 border-b border-slate-800/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'chats'
                  ? 'Search chats or usernames...'
                  : activeTab === 'contacts'
                  ? 'Search all roles, names, @usernames, phones...'
                  : 'Search call history...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── TAB 1: CHATS LIST ──────────────────────────────── */}
        {activeTab === 'chats' && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading chats...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No chats found.</p>
                <button
                  onClick={() => setActiveTab('contacts')}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  Browse Users by Role
                </button>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const title = conv.isGroup ? conv.title : conv.otherUser?.fullName || conv.title
                const otherUser = conv.otherUser
                const isOnline = otherUser ? onlineUserIds.includes(otherUser.id) : false

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id)
                      void loadMessages(conv.id)
                    }}
                    className={`w-full text-left px-3.5 py-3 hover:bg-slate-900/80 transition-colors flex items-center gap-3 relative ${
                      activeConvId === conv.id ? 'bg-slate-900 border-l-4 border-emerald-500' : ''
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md ${
                          conv.isGroup
                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                            : 'bg-gradient-to-br from-emerald-500 to-teal-700'
                        }`}
                      >
                        {conv.isGroup ? <Users className="w-5 h-5" /> : getInitials(title)}
                      </div>
                      {!conv.isGroup && isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-100 truncate">{title}</span>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                          {otherUser?.username && (
                            <span className="text-emerald-400/90 font-medium">@{otherUser.username}:</span>
                          )}
                          <span className="truncate">
                            {conv.lastMessageType === 'AUDIO'
                              ? '🎤 Voice note'
                              : conv.lastMessageType === 'LOCATION'
                              ? '📍 Location pin'
                              : conv.lastMessageType === 'IMAGE'
                              ? '📷 Photo'
                              : conv.lastMessage || 'No messages yet'}
                          </span>
                        </div>

                        {conv.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>

                      {!conv.isGroup && otherUser && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            {otherUser.roleName}
                          </span>
                          {otherUser.phone && (
                            <span className="text-[9px] text-slate-400 font-mono">📞 {otherUser.phone}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* ── TAB 2: ROLES & USERS DIRECTORY ─────────────────── */}
        {activeTab === 'contacts' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
            {/* Role Filter Pills */}
            <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              <button
                onClick={() => setSelectedRole('ALL')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0 ${
                  selectedRole === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Roles ({allUsers.length})
              </button>
              {roles.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.name)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors shrink-0 ${
                    selectedRole === r.name
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {r.name} ({r.user_count})
                </button>
              ))}
            </div>

            {/* Users list under this role */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No users found in this role or matching search.
                </div>
              ) : (
                filteredUsers.map(u => {
                  const isOnline = onlineUserIds.includes(u.id)
                  const isMe = u.id === user?.id

                  return (
                    <div
                      key={u.id}
                      className="p-3 hover:bg-slate-900 rounded-xl transition-all flex items-center gap-3 group"
                    >
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center font-bold text-xs text-white shadow">
                          {getInitials(u.fullName)}
                        </div>
                        {isOnline && (
                          <span
                            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950"
                            title="Online now"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-100 truncate">{u.fullName}</p>
                          {isMe && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold">
                              YOU
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] font-mono text-emerald-400 font-semibold truncate">
                          @{u.username}
                        </p>

                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono font-medium">
                            {u.roleName}
                          </span>
                          {u.employeeCode && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{u.employeeCode}</span>
                            </>
                          )}
                        </div>

                        {u.phone && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <span>📞</span> {u.phone}
                          </p>
                        )}
                      </div>

                      {/* Direct Call & Message Actions */}
                      {!isMe && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => void startCall(u, 'AUDIO')}
                            className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                            title={`Call @${u.username} (Audio)`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => void startCall(u, 'VIDEO')}
                            className="w-8 h-8 rounded-full bg-blue-950/80 border border-blue-700/60 text-blue-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            title={`Video Call @${u.username}`}
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>

                          {u.phone && (
                            <a
                              href={`tel:${u.phone.replace(/[^0-9+]/g, '')}`}
                              className="w-8 h-8 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-400 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                              title={`Direct Dial Phone: ${u.phone}`}
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            onClick={() => void startChatWithUser(u)}
                            className="w-8 h-8 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center hover:bg-slate-700 transition-colors shadow-sm"
                            title={`Message @${u.username}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: CALLS LOG ───────────────────────────────── */}
        {activeTab === 'calls' && (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1">
            {callLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Phone className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p>No call history yet.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Start an audio or video call from the Contacts or Chat header.
                </p>
              </div>
            ) : (
              callLogs.map(log => {
                const isMissed = log.status === 'MISSED'
                return (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-slate-900 rounded-xl transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {getInitials(log.otherUser.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isMissed ? 'text-red-400' : 'text-slate-100'}`}>
                          {log.otherUser.fullName}
                        </p>
                        <p className="text-[10px] text-emerald-400 font-mono">@{log.otherUser.username}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          {log.isOutgoing ? (
                            <PhoneOutgoing className="w-3 h-3 text-emerald-400" />
                          ) : isMissed ? (
                            <PhoneMissed className="w-3 h-3 text-red-400" />
                          ) : (
                            <PhoneIncoming className="w-3 h-3 text-sky-400" />
                          )}
                          <span>{timeAgo(log.startedAt)}</span>
                          {log.duration > 0 && <span>• {formatSeconds(log.duration)}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        void startCall(
                          {
                            id: log.otherUser.id,
                            fullName: log.otherUser.fullName,
                            username: log.otherUser.username,
                            phone: log.otherUser.phone,
                            roleName: log.otherUser.roleName,
                          },
                          log.callType
                        )
                      }
                      className="p-2 rounded-full bg-slate-800 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                      title="Call back"
                    >
                      {log.callType === 'VIDEO' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── TAB 4: ANALYTICS & STORAGE SIDEBAR ─────────────── */}
        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Database className="w-4 h-4" /> Permanent History Retention
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All chats, media, voice notes, and calls are permanently archived in the compliance database.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Messages</p>
                <p className="text-lg font-extrabold text-emerald-400 mt-0.5">{analytics?.totals?.total_messages ?? '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Conversations</p>
                <p className="text-lg font-extrabold text-sky-400 mt-0.5">{analytics?.totals?.total_conversations ?? '—'}</p>
              </div>
            </div>

            <button
              onClick={() => void handleExportChats()}
              disabled={exporting}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Chat History (JSON)
            </button>
          </div>
        )}
      </div>

      {/* ── MAIN CHAT AREA (WhatsApp Web Pattern) ───────────── */}
      <div className={`flex-1 flex flex-col min-w-0 bg-slate-900 ${!activeConvId && activeTab !== 'analytics' && isMobileView ? 'hidden' : 'flex'}`}>
        {activeTab === 'analytics' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100 space-y-6">
            {/* Header with Export Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  Chat Analytics & Complete History Storage
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Full communication metrics, daily activity trends, breakdown by role, and audit preservation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void loadAnalytics()}
                  disabled={analyticsLoading}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Refresh statistics"
                >
                  <Activity className={`w-3.5 h-3.5 text-emerald-400 ${analyticsLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>

                <button
                  onClick={() => void handleExportChats()}
                  disabled={exporting}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
                  title="Export all chat history as JSON"
                >
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Export Complete Archive
                </button>
              </div>
            </div>

            {/* Permanent Storage Notice */}
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3 text-xs text-emerald-200">
              <Database className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-300">Permanent Record Retention Active</p>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                  Every chat message, audio recording, photo evidence, document, and call event is encrypted and permanently retained with complete audit integrity. Zero messages are purged.
                </p>
              </div>
            </div>

            {/* Top 4 Storage Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Messages Stored</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {analytics?.totals?.total_messages ?? 0}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Indexed across all conversations</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Conversations</p>
                <p className="text-2xl font-black text-sky-400 mt-1">
                  {analytics?.totals?.total_conversations ?? 0}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">{analytics?.totals?.total_members ?? 0} total memberships</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voice & Video Calls</p>
                <p className="text-2xl font-black text-purple-400 mt-1">
                  {analytics?.callStats?.reduce((s, c) => s + c.count, 0) ?? 0}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {Math.round((analytics?.callStats?.reduce((s, c) => s + c.total_duration, 0) || 0) / 60)} min logged
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage Consumed</p>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {((analytics?.storageStats?.total_characters || 0) / 1024).toFixed(1)} KB
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Text & message data payload</p>
              </div>
            </div>

            {/* Recharts Grid (2x2) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Chart 1: Message Volume Trend (Past 14 Days) */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Daily Message Volume (Last 14 Days)
                </h3>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics?.volumeTrend || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="count" name="Messages" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#msgGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Message Volume by Role */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" /> Messages Sent by User Role
                </h3>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.roleDistribution || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="role_name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                      <Bar dataKey="count" name="Messages" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Message Types Breakdown */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" /> Message Types Distribution
                </h3>
                <div className="h-56 w-full flex items-center justify-center">
                  {(analytics?.typeDistribution || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No message data recorded yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics?.typeDistribution}
                          dataKey="count"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={4}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {(analytics?.typeDistribution || []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Chart 4: Call Statistics */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" /> Voice & Video Call Breakdown
                </h3>
                <div className="h-56 w-full">
                  {(analytics?.callStats || []).length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      No call logs recorded yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.callStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="call_type" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                        <Bar dataKey="count" name="Call Count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : !activeConvId || !activeConv ? (
          /* Splash Screen */
          <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 rounded-3xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <MessageSquare className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-base font-bold text-slate-100">WhatsApp for BSC Exclusive</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Connect seamlessly with any team member across all company roles. Real-time messages, audio/video calling, and continuous live tracking.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setActiveTab('contacts')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  View All Roles & Call
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* WhatsApp Active Chat Header */}
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shadow-sm shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {isMobileView && (
                  <button
                    onClick={() => setActiveConvId(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Avatar */}
                <div
                  onClick={() => activeConv.otherUser && setInspectUser(activeConv.otherUser)}
                  className="relative cursor-pointer shrink-0"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-800 flex items-center justify-center text-xs font-bold text-white shadow">
                    {activeConv.isGroup ? <Users className="w-5 h-5" /> : getInitials(activeConv.otherUser?.fullName || 'Chat')}
                  </div>
                  {!activeConv.isGroup && activeConv.otherUser && onlineUserIds.includes(activeConv.otherUser.id) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
                  )}
                </div>

                {/* Name & status */}
                <div
                  onClick={() => activeConv.otherUser && setInspectUser(activeConv.otherUser)}
                  className="min-w-0 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-100 truncate">
                      {activeConv.isGroup ? activeConv.title : activeConv.otherUser?.fullName}
                    </p>
                    {activeConv.otherUser?.roleName && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-mono font-bold">
                        {activeConv.otherUser.roleName}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 truncate">
                    {partnerTyping ? (
                      <span className="text-emerald-400 font-medium animate-pulse">{partnerTyping}</span>
                    ) : activeConv.isGroup ? (
                      `${activeConv.members.length} members`
                    ) : (
                      <>
                        <span className="text-emerald-400 font-mono">@{activeConv.otherUser?.username}</span>
                        {activeConv.otherUser && onlineUserIds.includes(activeConv.otherUser.id) ? (
                          <span className="text-emerald-400 ml-1.5 font-medium">● Online</span>
                        ) : (
                          <span className="text-slate-500 ml-1.5">Last seen recently</span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!activeConv.isGroup && activeConv.otherUser && (
                  <>
                    <button
                      onClick={() => void startCall(activeConv.otherUser!, 'AUDIO')}
                      className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-emerald-400 hover:border-emerald-700 flex items-center justify-center transition-all shadow-sm"
                      title={`Audio Call @${activeConv.otherUser.username}`}
                    >
                      <Phone className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => void startCall(activeConv.otherUser!, 'VIDEO')}
                      className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-blue-400 hover:border-blue-700 flex items-center justify-center transition-all shadow-sm"
                      title={`Video Call @${activeConv.otherUser.username}`}
                    >
                      <Video className="w-4 h-4" />
                    </button>

                    {activeConv.otherUser.phone && (
                      <a
                        href={`tel:${activeConv.otherUser.phone.replace(/[^0-9+]/g, '')}`}
                        className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-amber-400 hover:border-amber-700 flex items-center justify-center transition-all shadow-sm"
                        title={`Direct Dial Phone: ${activeConv.otherUser.phone}`}
                      >
                        <PhoneCall className="w-4 h-4" />
                      </a>
                    )}
                  </>
                )}

                <button
                  onClick={() => setShowMsgSearch(!showMsgSearch)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    showMsgSearch ? 'bg-emerald-600 text-white' : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Search messages in conversation"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setInspectUser(activeConv.otherUser || null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
                  title="Contact Information"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* In-Chat Message Search Bar */}
            {showMsgSearch && (
              <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search messages in this chat..."
                  value={msgSearchQuery}
                  onChange={e => setMsgSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                  autoFocus
                />
                {msgSearchQuery && (
                  <button onClick={() => setMsgSearchQuery('')} className="text-slate-400 hover:text-slate-200">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* ── WhatsApp Messages Stream Area ─────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 bg-slate-900/90 relative">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-16 text-xs text-slate-400">
                  {msgSearchQuery ? 'No matching messages found.' : 'No messages yet. Send a message to get started!'}
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isMe = msg.senderId === user?.id

                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                      <div
                        className={`max-w-[80%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl px-3.5 py-2 relative shadow-md text-xs leading-relaxed ${
                          isMe
                            ? 'bg-emerald-700 text-white rounded-tr-sm'
                            : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/60'
                        }`}
                      >
                        {!isMe && activeConv.isGroup && (
                          <p className="text-[10px] font-bold text-emerald-300 mb-0.5">
                            {msg.senderName} <span className="font-mono text-slate-400 font-normal">(@{msg.senderUsername})</span>
                          </p>
                        )}

                        {msg.isDeleted ? (
                          <span className="italic text-slate-400/80">This message was deleted</span>
                        ) : msg.messageType === 'AUDIO' ? (
                          <div className="flex items-center gap-2 py-1 min-w-[180px]">
                            <button
                              onClick={() => togglePlayAudio(msg.id, msg.content)}
                              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center shrink-0 transition-colors"
                            >
                              {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                            </button>
                            <div className="flex-1">
                              <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-white rounded-full ${
                                    playingAudioId === msg.id ? 'w-3/4 animate-pulse' : 'w-1/3'
                                  }`}
                                />
                              </div>
                              <span className="text-[9px] text-white/70 mt-1 block">Voice Note</span>
                            </div>
                          </div>
                        ) : msg.messageType === 'LOCATION' ? (
                          (() => {
                            try {
                              const loc = JSON.parse(msg.content)
                              return (
                                <div className="space-y-1.5 py-0.5">
                                  <div className="flex items-center gap-1.5 font-bold text-emerald-200">
                                    <MapPin className="w-4 h-4 text-emerald-300 shrink-0" />
                                    <span>Shared Live Location</span>
                                  </div>
                                  <p className="text-[11px] font-mono text-slate-200">
                                    Lat: {loc.latitude?.toFixed(5)}, Lng: {loc.longitude?.toFixed(5)}
                                  </p>
                                  {loc.accuracy && (
                                    <p className="text-[10px] text-white/70">GPS Accuracy: ±{Math.round(loc.accuracy)}m</p>
                                  )}
                                  <a
                                    href={loc.mapUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-200 underline hover:text-white"
                                  >
                                    View on Google Maps <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )
                            } catch {
                              return <span>{msg.content}</span>
                            }
                          })()
                        ) : msg.messageType === 'IMAGE' ? (
                          <div className="space-y-1">
                            <img
                              src={msg.content}
                              alt="Attachment"
                              className="max-h-60 rounded-lg cursor-pointer object-cover hover:opacity-95 transition-opacity"
                              onClick={() => setLightboxImage(msg.content)}
                            />
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                        )}

                        {/* Time & Double Checkmark Status */}
                        <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[9px] ${isMe ? 'text-emerald-100/70' : 'text-slate-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {isMe && !msg.isDeleted && (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                          )}
                        </div>

                        {/* Delete message button */}
                        {isMe && !msg.isDeleted && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this message for everyone?')) void deleteMessage(msg.id)
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-950"
                            title="Delete message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Chat Input Footer Bar ──────────────────────── */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0 relative">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-4 mb-2 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl flex items-center gap-2 text-lg z-20">
                  {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '👏', '✅'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setNewMessage(prev => prev + emoji)
                        setShowEmojiPicker(false)
                        inputRef.current?.focus()
                      }}
                      className="hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {showAttachMenu && (
                <div className="absolute bottom-full left-12 mb-2 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl space-y-1 z-20 w-52">
                  <button
                    onClick={() => void shareLiveLocation()}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-xs font-semibold flex items-center gap-2.5 text-emerald-400 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Share Live Location</span>
                  </button>

                  <label className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-xs font-semibold flex items-center gap-2.5 text-sky-400 cursor-pointer transition-colors">
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                    <span>Send Photo</span>
                    <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                  </label>
                </div>
              )}

              {isRecording ? (
                <div className="flex items-center justify-between gap-3 bg-red-950/60 border border-red-800/80 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2 text-red-400 animate-pulse text-xs font-semibold">
                    <Radio className="w-4 h-4" />
                    <span>Recording Voice Note: {formatSeconds(recordingDuration)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelRecordingVoiceNote}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-red-400 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={stopRecordingVoiceNote}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    title="Emojis"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    title="Attach Location or Photo"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message (Enter to send, Shift+Enter for newline)..."
                    rows={1}
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors resize-none max-h-28"
                  />

                  {newMessage.trim() ? (
                    <button
                      onClick={() => void handleSendMessage()}
                      disabled={sending}
                      className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 shrink-0 shadow-md"
                      title="Send"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => void startRecordingVoiceNote()}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 transition-colors shrink-0 shadow-md"
                      title="Record Voice Note"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── CONTACT INSPECTION SIDE DRAWER ──────────────────── */}
      {inspectUser && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-slate-950 border-l border-slate-800 shadow-2xl p-5 flex flex-col z-30">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Contact Info</h3>
            <button onClick={() => setInspectUser(null)} className="text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-6 text-center border-b border-slate-800">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-800 flex items-center justify-center font-bold text-lg text-white mx-auto shadow-xl">
              {getInitials(inspectUser.fullName)}
            </div>
            <h4 className="text-sm font-bold text-slate-100 mt-3">{inspectUser.fullName}</h4>
            <p className="text-xs font-mono text-emerald-400 font-semibold mt-0.5">@{inspectUser.username}</p>
            <span className="inline-block mt-2 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
              {inspectUser.roleName}
            </span>
          </div>

          <div className="flex-1 py-4 space-y-3.5 text-xs">
            {inspectUser.phone && (
              <div>
                <p className="text-[10px] text-slate-400">Phone Number</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono text-slate-200">{inspectUser.phone}</span>
                  <a
                    href={`tel:${inspectUser.phone.replace(/[^0-9+]/g, '')}`}
                    className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Phone className="w-3 h-3" /> Dial
                  </a>
                </div>
              </div>
            )}

            {inspectUser.employeeCode && (
              <div>
                <p className="text-[10px] text-slate-400">Employee ID</p>
                <p className="font-mono text-slate-200 mt-0.5">{inspectUser.employeeCode}</p>
              </div>
            )}

            {inspectUser.email && (
              <div>
                <p className="text-[10px] text-slate-400">Company Email</p>
                <p className="font-mono text-slate-200 mt-0.5">{inspectUser.email}</p>
              </div>
            )}

            {inspectUser.departmentName && (
              <div>
                <p className="text-[10px] text-slate-400">Department</p>
                <p className="text-slate-200 mt-0.5">{inspectUser.departmentName}</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
            <button
              onClick={() => void startCall(inspectUser, 'AUDIO')}
              className="py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </button>

            <button
              onClick={() => void startCall(inspectUser, 'VIDEO')}
              className="py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
            >
              <Video className="w-3.5 h-3.5" /> Video
            </button>
          </div>
        </div>
      )}

      {/* ── WHATSAPP CALL SCREEN OVERLAY ─────────────────────── */}
      {activeCall && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-6">
          <div className="text-center mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400">
              <Shield className="w-3.5 h-3.5" /> End-to-End Encrypted Call
            </span>
          </div>

          <div className="text-center space-y-3">
            <div className="relative inline-block">
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-800 flex items-center justify-center text-3xl font-bold text-white shadow-2xl mx-auto">
                {getInitials(activeCall.targetUser.fullName)}
              </div>
              {activeCall.status === 'ringing' && (
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-75" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-100">{activeCall.targetUser.fullName}</h2>
              <p className="text-xs font-mono text-emerald-400">@{activeCall.targetUser.username}</p>
              <p className="text-xs text-slate-400 mt-1">
                {activeCall.status === 'ringing'
                  ? 'Ringing...'
                  : activeCall.status === 'connected'
                  ? `Connected (${formatSeconds(activeCall.duration)})`
                  : 'Call ended'}
              </p>
            </div>

            {activeCall.callType === 'VIDEO' && (
              <div className="w-64 h-48 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative mx-auto">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white">
                  You
                </div>
              </div>
            )}

            {activeCall.targetUser.phone && (
              <div className="pt-2">
                <a
                  href={`tel:${activeCall.targetUser.phone.replace(/[^0-9+]/g, '')}`}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline bg-amber-950/40 border border-amber-800/60 px-3 py-1.5 rounded-lg"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  Direct Phone Dial: {activeCall.targetUser.phone}
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setCallMuted(!callMuted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                callMuted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title={callMuted ? 'Unmute' : 'Mute'}
            >
              {callMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {activeCall.callType === 'VIDEO' && (
              <button
                onClick={() => setCallVideoOff(!callVideoOff)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  callVideoOff ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title={callVideoOff ? 'Turn video on' : 'Turn video off'}
              >
                {callVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            <button
              onClick={hangUpCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-105"
              title="End Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {/* ── INCOMING CALL MODAL ─────────────────────────────── */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-800 flex items-center justify-center text-2xl font-bold text-white shadow-xl mx-auto ring-4 ring-emerald-500/40 animate-pulse">
              {getInitials(incomingCall.callerName)}
            </div>

            <div>
              <p className="text-xs uppercase font-mono text-emerald-400 tracking-wider">
                Incoming {incomingCall.callType} Call
              </p>
              <h3 className="text-base font-bold text-slate-100 mt-1">{incomingCall.callerName}</h3>
              <p className="text-xs font-mono text-slate-400">@{incomingCall.callerUsername}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={declineIncomingCall}
                className="py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <PhoneOff className="w-4 h-4" /> Decline
              </button>

              <button
                onClick={() => void answerIncomingCall()}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <Phone className="w-4 h-4" /> Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW CHAT OR GROUP MODAL ─────────────────────────── */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">New Conversation</h3>
              <button onClick={() => setShowNewChat(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedMembers.length > 1 && (
              <div className="p-3 bg-slate-950/60 border-b border-slate-800">
                <input
                  type="text"
                  placeholder="Group Name (e.g. Audit Squad, Floor Operations)..."
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2">
              {allUsers.filter(u => u.id !== user?.id).map(u => {
                const isSelected = selectedMembers.includes(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedMembers(prev =>
                        prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                      isSelected ? 'bg-emerald-950/80 border border-emerald-800' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {getInitials(u.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-100 truncate">{u.fullName}</p>
                      <p className="text-[10px] text-emerald-400 font-mono">@{u.username} · {u.roleName}</p>
                    </div>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="w-4 h-4 rounded border border-slate-600" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{selectedMembers.length} selected</span>
              <button
                onClick={() => {
                  if (selectedMembers.length === 1) {
                    const single = allUsers.find(u => u.id === selectedMembers[0])
                    if (single) void startChatWithUser(single)
                  } else {
                    void createGroupChat()
                  }
                }}
                disabled={selectedMembers.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow"
              >
                {selectedMembers.length > 1 ? 'Create Group' : 'Start Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE LIGHTBOX MODAL ────────────────────────────── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={lightboxImage}
            alt="Expanded view"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

    </div>
  )
}
