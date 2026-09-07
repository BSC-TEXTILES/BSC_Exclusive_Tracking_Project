import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

const SYSTEM_PROMPT = `You are BSC Exclusive AI Assistant, a helpful chatbot for the BSC Exclusive compliance platform. You help users with:
- Understanding how to use the platform
- Explaining features like checkpoints, GPS tracking, evidence uploads, approvals
- Troubleshooting common issues
- Answering questions about compliance tracking
- Providing guidance on submissions, reports, and admin functions

Be concise, helpful, and friendly. If you don't know something specific about the platform, guide the user to contact their admin.`

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi! I'm the BSC Exclusive AI Assistant. I can help you with:\n\n• Understanding checkpoints & submissions\n• GPS tracking & evidence uploads\n• Approval workflows\n• Platform features & navigation\n\nHow can I help you today?"
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (GEMINI_API_KEY) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: 'Understood. I am the BSC Exclusive AI Assistant, ready to help users with the compliance platform.' }] },
                ...messages.map(m => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }]
                })),
                { role: 'user', parts: [{ text }] }
              ]
            })
          }
        )

        const data = await response.json()
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
          || "I couldn't process that. Please try again."
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      } else {
        const lower = text.toLowerCase()
        let reply = ''

        if (lower.includes('checkpoint') || lower.includes('task')) {
          reply = "Checkpoints are compliance tasks assigned to you. Go to **Dashboard** → you'll see pending checkpoints with due dates. Click on one to fill details, attach evidence, and submit. Drafts auto-save as you type."
        } else if (lower.includes('submit') || lower.includes('evidence') || lower.includes('upload')) {
          reply = "To submit a checkpoint: Open the checkpoint → fill required fields → attach images/PDFs/audio as evidence → click **Submit**. You can save as draft and continue later. Supervisors review within 1 hour or it auto-approves."
        } else if (lower.includes('approval') || lower.includes('approve') || lower.includes('reject')) {
          reply = "After submission, a supervisor reviews your report. If not reviewed within **1 hour**, it **auto-approves**. You'll get a notification when your submission is approved or rejected."
        } else if (lower.includes('gps') || lower.includes('location') || lower.includes('tracking')) {
          reply = "GPS tracking runs automatically every **30 minutes** during your active session. Your location appears on the admin map. No manual check-ins needed — it's passive and secure."
        } else if (lower.includes('login') || lower.includes('password') || lower.includes('locked')) {
          reply = "Enter your employee code and password on the login page. After **5 failed attempts**, your account locks for **5 minutes**. Contact your admin if you need a password reset."
        } else if (lower.includes('report') || lower.includes('dashboard') || lower.includes('export')) {
          reply = "Check your **Dashboard** for visual analytics and charts. Go to **Reports** to view detailed data. Admins can export everything as **CSV** with one click."
        } else if (lower.includes('notification') || lower.includes('alert')) {
          reply = "You'll receive real-time notifications for: new assignments, submission approvals, rejections, and important updates. Check the bell icon in the top-right corner."
        } else if (lower.includes('admin') || lower.includes('role') || lower.includes('supervisor')) {
          reply = "There are three roles: **Admin** (full access), **Supervisor** (reviews submissions), and **Field User** (submits reports). Only admins can create accounts and manage roles."
        } else if (lower.includes('chat') || lower.includes('whatsapp')) {
          reply = "The platform includes a built-in **Chat** feature for team communication. Admins can also manage **WhatsApp** integrations for customer communication."
        } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
          reply = "Hello! Welcome to BSC Exclusive. I'm here to help you navigate the platform. What would you like to know?"
        } else if (lower.includes('help') || lower.includes('how') || lower.includes('what')) {
          reply = "I can help with:\n\n• **Checkpoints** — Creating and submitting tasks\n• **GPS** — How location tracking works\n• **Approvals** — Submission review process\n• **Reports** — Viewing dashboards and exports\n• **Login** — Account access and security\n• **Notifications** — Alert system\n\nJust ask about any of these topics!"
        } else {
          reply = "Thanks for your question! I can help with checkpoints, GPS tracking, submissions, approvals, reports, notifications, and platform navigation. Could you be more specific about what you'd like to know?"
        }

        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again later or contact your admin for help."
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/•/g, '&bull;')
      .split('\n')
      .map((line, i) => `<div key="${i}">${line || '<br/>'}</div>`)
      .join('')
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
        aria-label="Open chat"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5 group-hover:animate-bounce" />
        )}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[9999] w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="bg-gray-900 dark:bg-gray-800 px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white">BSC AI Assistant</h3>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'assistant'
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : 'bg-gray-900 dark:bg-white'
                }`}>
                  {msg.role === 'assistant' ? (
                    <Bot className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-white dark:text-gray-900" />
                  )}
                </div>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-md'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-tr-md'
                }`}>
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-md">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                rows={1}
                className="flex-1 resize-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-0 transition-shadow"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
