import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

router.get(
  '/',
  ah(async (req, res) => {
    const q = (req.query.q as string || '').trim()
    if (!q || q.length < 1) {
      return ok(res, { results: [], query: q, total: 0 })
    }

    const user = req.user!
    const term = `%${q}%`
    const isSuperAdmin = user.roleName === 'ADMIN'
    const isSupervisor = ['SUPERVISOR', 'MANAGER'].includes(user.roleName)

    const searchPromises: Promise<any>[] = []

    // 1. Search Users (Admin & Supervisor)
    if (isSuperAdmin || isSupervisor) {
      searchPromises.push(
        query(
          `SELECT
             u.id, u.employee_code, u.full_name, u.email, u.phone, u.username,
             u.status, u.account_type, u.customer_code, r.name AS role_name,
             d.name AS department_name, 'user' AS entity_type
           FROM users u
           JOIN roles r ON r.id = u.role_id
           LEFT JOIN departments d ON d.id = u.department_id
           WHERE (
             u.full_name ILIKE $1 OR
             u.email ILIKE $1 OR
             u.username ILIKE $1 OR
             u.employee_code ILIKE $1 OR
             u.phone ILIKE $1 OR
             r.name ILIKE $1 OR
             d.name ILIKE $1 OR
             u.status ILIKE $1 OR
             u.customer_code ILIKE $1
           )
           ORDER BY u.full_name ASC LIMIT 10`,
          [term]
        ).then(r => r.rows)
      )
    } else {
      searchPromises.push(Promise.resolve([]))
    }

    // 2. Search Customers Directory (All roles can search relevant customer contact info)
    searchPromises.push(
      query(
        `SELECT
           c.id, c.customer_code, c.name, c.contact_person, c.email,
           c.phone, c.whatsapp_number, c.city, c.state, c.status,
           'customer' AS entity_type
         FROM customers c
         WHERE (
           c.name ILIKE $1 OR
           c.customer_code ILIKE $1 OR
           c.contact_person ILIKE $1 OR
           c.email ILIKE $1 OR
           c.phone ILIKE $1 OR
           c.city ILIKE $1 OR
           c.status ILIKE $1
         )
         ORDER BY c.name ASC LIMIT 10`,
        [term]
      ).then(r => r.rows)
    )

    // 3. Search Checkpoints & Processes
    searchPromises.push(
      query(
        `SELECT
           cp.id, cp.title, cp.code, cp.description, cp.category,
           cp.status, m.title AS module_title, 'checkpoint' AS entity_type
         FROM checkpoints cp
         LEFT JOIN modules m ON m.id = cp.module_id
         WHERE (
           cp.title ILIKE $1 OR
           cp.code ILIKE $1 OR
           cp.description ILIKE $1 OR
           cp.category ILIKE $1 OR
           m.title ILIKE $1
         )
         ORDER BY cp.title ASC LIMIT 10`,
        [term]
      ).then(r => r.rows)
    )

    // 4. Search Modules
    searchPromises.push(
      query(
        `SELECT
           m.id, m.title, m.code, m.description, m.category,
           m.status, 'module' AS entity_type
         FROM modules m
         WHERE (
           m.title ILIKE $1 OR
           m.code ILIKE $1 OR
           m.description ILIKE $1 OR
           m.category ILIKE $1
         )
         ORDER BY m.title ASC LIMIT 10`,
        [term]
      ).then(r => r.rows)
    )

    // 5. Search Submissions / Inspections
    searchPromises.push(
      query(
        `SELECT
           s.id, s.checkpoint_id, s.status, s.remarks, s.created_at,
           cp.title AS checkpoint_title, u.full_name AS submitter_name,
           'submission' AS entity_type
         FROM checkpoint_submissions s
         JOIN checkpoints cp ON cp.id = s.checkpoint_id
         JOIN users u ON u.id = s.user_id
         WHERE (
           cp.title ILIKE $1 OR
           u.full_name ILIKE $1 OR
           s.remarks ILIKE $1 OR
           s.status ILIKE $1
         )
         ORDER BY s.created_at DESC LIMIT 10`,
        [term]
      ).then(r => r.rows)
    )

    const [users, customers, checkpoints, modules, submissions] = await Promise.all(searchPromises)

    const allResults = [
      ...users.map((u: any) => ({
        id: u.id,
        type: 'user',
        title: u.full_name,
        subtitle: `${u.role_name} • ${u.department_name || 'No Dept'} • ${u.employee_code}`,
        meta: { email: u.email, phone: u.phone, status: u.status, accountType: u.account_type },
        url: isSuperAdmin ? '/admin/users' : '/supervisor/team',
      })),
      ...customers.map((c: any) => ({
        id: c.id,
        type: 'customer',
        title: c.name,
        subtitle: `Customer Code: ${c.customer_code} • Contact: ${c.contact_person || 'N/A'} • ${c.city || ''}`,
        meta: { email: c.email, phone: c.phone || c.whatsapp_number, status: c.status },
        url: '/admin/whatsapp',
      })),
      ...checkpoints.map((cp: any) => ({
        id: cp.id,
        type: 'checkpoint',
        title: cp.title,
        subtitle: `Code: ${cp.code || 'N/A'} • Module: ${cp.module_title || 'General'} • ${cp.category || 'Quality'}`,
        meta: { status: cp.status },
        url: `/checkpoints/${cp.id}`,
      })),
      ...modules.map((m: any) => ({
        id: m.id,
        type: 'module',
        title: m.title,
        subtitle: `Module Code: ${m.code || 'N/A'} • Category: ${m.category || 'General'}`,
        meta: { status: m.status },
        url: `/modules/${m.id}`,
      })),
      ...submissions.map((s: any) => ({
        id: s.id,
        type: 'submission',
        title: `Submission: ${s.checkpoint_title}`,
        subtitle: `Submitted by: ${s.submitter_name} • Status: ${s.status}`,
        meta: { remarks: s.remarks, date: s.created_at },
        url: `/submissions/${s.id}`,
      })),
    ]

    ok(res, {
      results: allResults,
      query: q,
      total: allResults.length,
      grouped: {
        users: users.length,
        customers: customers.length,
        checkpoints: checkpoints.length,
        modules: modules.length,
        submissions: submissions.length,
      },
    })
  })
)

export default router
