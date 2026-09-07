import { useEffect, useCallback, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { apiUrl } from './api'

interface UseSocketReturn {
  socket: Socket | null
  connected: boolean
  sendMessage: (conversationId: string, content: string, messageType?: string) => void
  joinChat: (conversationId: string) => void
  leaveChat: (conversationId: string) => void
  sendTyping: (conversationId: string) => void
  stopTyping: (conversationId: string) => void
  sendTrackingUpdate: (data: { latitude: number; longitude: number; accuracy?: number; batteryLevel?: number }) => void
  initiateCall: (toUserId: string, conversationId: string | undefined, callType: 'AUDIO' | 'VIDEO') => void
  acceptCall: (callerId: string, callType: 'AUDIO' | 'VIDEO') => void
  rejectCall: (callerId: string, reason?: string) => void
  endCall: (toUserId: string, duration?: number) => void
  sendCallSignal: (toUserId: string, signal: any) => void
}

let globalSocketRef: Socket | null = null

export function getSocket(): Socket | null {
  return globalSocketRef
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Get cookie for auth
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
      return match ? match[2] : null
    }

    const token = getCookie('bsc_session')

    const socket = io(apiUrl('/'), {
      auth: { token: token || undefined },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', () => {
      setConnected(false)
    })

    socketRef.current = socket
    globalSocketRef = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      globalSocketRef = null
    }
  }, [])

  const sendMessage = useCallback((conversationId: string, content: string, messageType: string = 'TEXT') => {
    socketRef.current?.emit('chat:message', { conversationId, content, messageType })
  }, [])

  const joinChat = useCallback((conversationId: string) => {
    socketRef.current?.emit('chat:join', conversationId)
  }, [])

  const leaveChat = useCallback((conversationId: string) => {
    socketRef.current?.emit('chat:leave', conversationId)
  }, [])

  const sendTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('chat:typing', { conversationId })
  }, [])

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('chat:stop-typing', { conversationId })
  }, [])

  const sendTrackingUpdate = useCallback((data: { latitude: number; longitude: number; accuracy?: number; batteryLevel?: number }) => {
    socketRef.current?.emit('tracking:update', data)
  }, [])

  const initiateCall = useCallback((toUserId: string, conversationId: string | undefined, callType: 'AUDIO' | 'VIDEO') => {
    socketRef.current?.emit('call:initiate', { toUserId, conversationId, callType })
  }, [])

  const acceptCall = useCallback((callerId: string, callType: 'AUDIO' | 'VIDEO') => {
    socketRef.current?.emit('call:accept', { callerId, callType })
  }, [])

  const rejectCall = useCallback((callerId: string, reason?: string) => {
    socketRef.current?.emit('call:reject', { callerId, reason })
  }, [])

  const endCall = useCallback((toUserId: string, duration?: number) => {
    socketRef.current?.emit('call:end', { toUserId, duration })
  }, [])

  const sendCallSignal = useCallback((toUserId: string, signal: any) => {
    socketRef.current?.emit('call:signal', { toUserId, signal })
  }, [])

  return {
    socket: socketRef.current,
    connected,
    sendMessage,
    joinChat,
    leaveChat,
    sendTyping,
    stopTyping,
    sendTrackingUpdate,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    sendCallSignal,
  }
}
