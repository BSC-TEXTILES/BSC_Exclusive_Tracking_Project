import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts'
import { Users, UserCheck, ShieldAlert, UserPlus } from 'lucide-react'
import { get } from '../lib/api'
import { useChartTheme } from '../lib/chartTheme'

interface AnalyticsData {
  totals: {
    total_users: number
    bsc_users: number
    customer_accounts: number
    total_customers_directory: number
    active_count: number
    inactive_count: number
    suspended_count: number
    new_this_month: number
  }
  rolesBreakdown: { role_name: string; count: number }[]
  departmentBreakdown: { department_name: string; count: number }[]
  trend: { label: string; users_count: number; customers_count: number }[]
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

export default function UserAnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const chart = useChartTheme()

  useEffect(() => {
    get<AnalyticsData>('/api/admin/user-analytics')
      .then((d) => setData(d))
      .catch((err) => console.error('Failed to load user analytics:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="card p-6 mb-6 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
          <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
        </div>
      </div>
    )
  }

  const { totals, departmentBreakdown, trend } = data

  const pieData = [
    { name: 'BSC Team Users', value: totals.bsc_users },
    { name: 'Customer Accounts', value: totals.customer_accounts || (totals.total_customers_directory || 0) },
  ]

  const tooltipStyle = {
    backgroundColor: chart.tooltipBg,
    borderRadius: '8px',
    color: chart.tooltipText,
    fontSize: '11px',
    border: `1px solid ${chart.tooltipBorder}`,
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Top 4 KPI metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3.5 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Accounts</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{totals.total_users}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{totals.bsc_users} BSC • {totals.customer_accounts} Customers</p>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Active Accounts</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{totals.active_count}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
              {totals.total_users > 0 ? Math.round((totals.active_count / totals.total_users) * 100) : 100}% Active rate
            </p>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Restricted / Suspended</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{totals.suspended_count}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{totals.inactive_count} Inactive</p>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">New This Month</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{totals.new_this_month}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Created in last 30 days</p>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut Chart: User Distribution */}
        <div className="card p-4">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            User Account Distribution
          </h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs mt-1">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }}></span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart: Users by Department */}
        <div className="card p-4">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Users by Department
          </h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentBreakdown.slice(0, 5)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.gridColor} />
                <XAxis dataKey="department_name" tick={{ fontSize: 9, fill: chart.textColor }} angle={-20} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: chart.textColor }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Area Chart: Registration Trend */}
        <div className="card p-4">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Registration Trend (Last 14 Days)
          </h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.gridColor} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: chart.textColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: chart.textColor }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="users_count" stroke="#10b981" fillOpacity={1} fill="url(#userGrad)" name="New Users" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
