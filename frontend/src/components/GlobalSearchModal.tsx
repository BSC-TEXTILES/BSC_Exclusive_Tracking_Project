import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader2, User, Building2, CheckSquare, Layers, FileText, ArrowRight } from 'lucide-react'
import { get } from '../lib/api'

interface SearchResult {
  id: string
  type: 'user' | 'customer' | 'checkpoint' | 'module' | 'submission'
  title: string
  subtitle: string
  meta: Record<string, any>
  url: string
}

interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
  grouped: {
    users: number
    customers: number
    checkpoints: number
    modules: number
    submissions: number
  }
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalSearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'user' | 'customer' | 'checkpoint' | 'module' | 'submission'>('ALL')
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
      setSearched(false)
    }
  }, [open])

  // Handle Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await get<SearchResponse>(`/api/search?q=${encodeURIComponent(query.trim())}`)
        setResults(res.results || [])
        setSearched(true)
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  if (!open) return null

  const filteredResults = activeFilter === 'ALL'
    ? results
    : results.filter(r => r.type === activeFilter)

  const handleSelect = (url: string) => {
    onClose()
    navigate(url)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'user': return <User className="w-4 h-4 text-blue-500" />
      case 'customer': return <Building2 className="w-4 h-4 text-emerald-500" />
      case 'checkpoint': return <CheckSquare className="w-4 h-4 text-amber-500" />
      case 'module': return <Layers className="w-4 h-4 text-purple-500" />
      case 'submission': return <FileText className="w-4 h-4 text-rose-500" />
      default: return <Search className="w-4 h-4 text-slate-400" />
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'user': return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">User</span>
      case 'customer': return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Customer</span>
      case 'checkpoint': return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Checkpoint</span>
      case 'module': return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Module</span>
      case 'submission': return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Submission</span>
      default: return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 font-medium"
            placeholder="Search by User ID, Customer Code, Name, Email, Phone, PO/Order, Module..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Filter Chips */}
        {results.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setActiveFilter('user')}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                activeFilter === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Users ({results.filter(r => r.type === 'user').length})
            </button>
            <button
              onClick={() => setActiveFilter('customer')}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                activeFilter === 'customer'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Customers ({results.filter(r => r.type === 'customer').length})
            </button>
            <button
              onClick={() => setActiveFilter('checkpoint')}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                activeFilter === 'checkpoint'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Checkpoints ({results.filter(r => r.type === 'checkpoint').length})
            </button>
            <button
              onClick={() => setActiveFilter('module')}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                activeFilter === 'module'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Modules ({results.filter(r => r.type === 'module').length})
            </button>
            <button
              onClick={() => setActiveFilter('submission')}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                activeFilter === 'submission'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Submissions ({results.filter(r => r.type === 'submission').length})
            </button>
          </div>
        )}

        {/* Results List */}
        <div className="overflow-y-auto flex-1 p-2 divide-y divide-slate-100">
          {!query.trim() && (
            <div className="py-12 px-6 text-center text-slate-400">
              <Search className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Universal System Search</p>
              <p className="text-xs mt-1 text-slate-400">
                Type any keyword to search across Users, Customers, Checkpoints, Modules, and Submissions
              </p>
            </div>
          )}

          {query.trim() && searched && filteredResults.length === 0 && !loading && (
            <div className="py-12 px-6 text-center text-slate-500">
              <p className="text-sm font-semibold text-slate-700">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs mt-1 text-slate-400">
                Try searching with a partial name, employee code, customer code, or phone number.
              </p>
            </div>
          )}

          {filteredResults.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => handleSelect(item.url)}
              className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors flex items-center justify-between group"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    {getTypeBadge(item.type)}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                  {item.meta?.phone && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Phone: {item.meta.phone} {item.meta.email ? `• ${item.meta.email}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0 transition-colors ml-2" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-4">
          <span>{filteredResults.length} item(s) found</span>
          <span className="text-slate-400">Click an item to navigate directly</span>
        </div>
      </div>
    </div>
  )
}
