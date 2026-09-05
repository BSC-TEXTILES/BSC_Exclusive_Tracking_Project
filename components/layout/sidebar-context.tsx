'use client'

import React, { createContext, useContext, useState } from 'react'

interface SidebarContextType {
  isExpanded: boolean
  toggleSidebar: () => void
  setIsExpanded: (expanded: boolean) => void
  isMobileOpen: boolean
  toggleMobile: () => void
  setIsMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Collapsed by default (showing icons only, 3 lines button expands to show text)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleSidebar = () => setIsExpanded(prev => !prev)
  const toggleMobile = () => setIsMobileOpen(prev => !prev)

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        toggleSidebar,
        setIsExpanded,
        isMobileOpen,
        toggleMobile,
        setIsMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
