import { redirect } from 'next/navigation'

export default function ModulesPage() {
  // Redirect to dashboard since modules are shown there
  redirect('/dashboard')
}
