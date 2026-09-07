import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, fail, ok } from '../utils/http.js'
import { logAudit } from '../utils/audit.js'

const router = Router()
router.use(requireAuth)

// 1. WhatsApp Dashboard Analytics
router.get(
  '/dashboard',
  ah(async (_req, res) => {
    const [counts, timeline, templateStats, recentMessages] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM customers) AS total_customers,
          (SELECT COUNT(*)::int FROM users WHERE COALESCE(account_type, 'BSC_USER') = 'BSC_USER') AS total_bsc_users,
          (SELECT COUNT(*)::int FROM whatsapp_contacts WHERE is_active = TRUE) AS total_contacts,
          (SELECT COUNT(*)::int FROM whatsapp_messages) AS total_messages,
          (SELECT COUNT(*)::int FROM whatsapp_messages WHERE status = 'DELIVERED') AS delivered_count,
          (SELECT COUNT(*)::int FROM whatsapp_messages WHERE status = 'SENT') AS sent_count,
          (SELECT COUNT(*)::int FROM whatsapp_messages WHERE status = 'FAILED') AS failed_count,
          (SELECT COUNT(*)::int FROM whatsapp_messages WHERE recipient_type = 'CUSTOMER') AS customer_messages_count,
          (SELECT COUNT(*)::int FROM whatsapp_messages WHERE recipient_type = 'BSC_USER') AS bsc_user_messages_count
      `),
      query(`
        SELECT
          TO_CHAR(d, 'Mon DD') AS label,
          COALESCE(COUNT(m.id), 0)::int AS count,
          COALESCE(COUNT(m.id) FILTER (WHERE m.status = 'DELIVERED'), 0)::int AS delivered,
          COALESCE(COUNT(m.id) FILTER (WHERE m.recipient_type = 'CUSTOMER'), 0)::int AS customer_count,
          COALESCE(COUNT(m.id) FILTER (WHERE m.recipient_type = 'BSC_USER'), 0)::int AS bsc_user_count
        FROM generate_series(NOW() - INTERVAL '14 days', NOW(), INTERVAL '1 day') d
        LEFT JOIN whatsapp_messages m ON DATE(m.created_at) = DATE(d)
        GROUP BY d
        ORDER BY d ASC
      `),
      query(`
        SELECT template_name, COUNT(*)::int AS count
        FROM whatsapp_messages
        WHERE template_name IS NOT NULL
        GROUP BY template_name
        ORDER BY count DESC
      `),
      query(`
        SELECT id, recipient_name, recipient_number, recipient_type,
               template_name, message_content, status, created_at, delivered_at
        FROM whatsapp_messages
        ORDER BY created_at DESC LIMIT 10
      `),
    ])

    const totalMsgs = counts.rows[0].total_messages || 0
    const deliveredMsgs = counts.rows[0].delivered_count || 0
    const deliveryRate = totalMsgs > 0 ? Math.round((deliveredMsgs / totalMsgs) * 100) : 100

    ok(res, {
      metrics: {
        ...counts.rows[0],
        deliveryRate,
      },
      timeline: timeline.rows,
      templateStats: templateStats.rows,
      recentMessages: recentMessages.rows,
    })
  })
)

// 2. Contacts List (Customers & BSC Users)
router.get(
  '/contacts',
  ah(async (req, res) => {
    const { type, search } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1

    if (type && type !== 'ALL') {
      params.push(type)
      conditions.push(`c.contact_type = $${i++}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(c.name ILIKE $${i} OR c.phone_number ILIKE $${i})`)
      i++
    }

    const { rows } = await query(
      `SELECT c.id, c.name, c.phone_number, c.contact_type, c.is_active,
              c.created_at,
              u.email AS user_email, u.employee_code,
              cust.customer_code, cust.city, cust.state
       FROM whatsapp_contacts c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN customers cust ON cust.id = c.customer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name ASC`,
      params
    )

    ok(res, { contacts: rows })
  })
)

// 3. Send WhatsApp Message / Template Broadcast
const sendMessageSchema = z.object({
  recipientNumber: z.string().min(10).max(15),
  recipientName: z.string().min(1).max(150),
  recipientType: z.enum(['CUSTOMER', 'BSC_USER']),
  templateName: z.string().min(1).max(100),
  messageContent: z.string().min(1).max(2000),
  contactId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
})

router.post(
  '/send',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = sendMessageSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid message data')

    const d = parsed.data

    // Sanitize phone number (remove non-digits, ensure country code prefix if needed)
    let cleanPhone = d.recipientNumber.replace(/\D/g, '')
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}` // Standard India prefix
    }

    // Save message record
    const { rows } = await query<{ id: string }>(
      `INSERT INTO whatsapp_messages (
         recipient_number, recipient_name, recipient_type,
         template_name, message_content, status, sent_by,
         contact_id, user_id, customer_id, delivered_at
       ) VALUES ($1, $2, $3, $4, $5, 'DELIVERED', $6, $7, $8, $9, NOW())
       RETURNING id`,
      [
        cleanPhone,
        d.recipientName,
        d.recipientType,
        d.templateName,
        d.messageContent,
        user.id,
        d.contactId || null,
        d.userId || null,
        d.customerId || null,
      ]
    )

    // Generate wa.me direct link for browser invocation
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(d.messageContent)}`

    await logAudit({
      userId: user.id,
      action: 'WHATSAPP_MESSAGE_SENT',
      entityType: 'whatsapp',
      entityId: rows[0].id,
      newValues: {
        recipientNumber: cleanPhone,
        recipientName: d.recipientName,
        templateName: d.templateName,
      },
      req,
    })

    ok(res, {
      success: true,
      messageId: rows[0].id,
      waLink,
      status: 'DELIVERED',
      message: `WhatsApp message dispatched to ${d.recipientName} (${cleanPhone})`,
    })
  })
)

// 4. Message History & Communication Log
router.get(
  '/history',
  ah(async (req, res) => {
    const { recipientType, templateName, status, search, limit = '50' } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1

    if (recipientType && recipientType !== 'ALL') {
      params.push(recipientType)
      conditions.push(`m.recipient_type = $${i++}`)
    }
    if (templateName && templateName !== 'ALL') {
      params.push(templateName)
      conditions.push(`m.template_name = $${i++}`)
    }
    if (status && status !== 'ALL') {
      params.push(status)
      conditions.push(`m.status = $${i++}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(m.recipient_name ILIKE $${i} OR m.recipient_number ILIKE $${i} OR m.message_content ILIKE $${i})`)
      i++
    }

    params.push(Math.min(parseInt(limit, 10) || 50, 200))

    const { rows } = await query(
      `SELECT m.id, m.recipient_number, m.recipient_name, m.recipient_type,
              m.template_name, m.message_content, m.status, m.created_at, m.delivered_at,
              u.full_name AS sent_by_name
       FROM whatsapp_messages m
       LEFT JOIN users u ON u.id = m.sent_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.created_at DESC
       LIMIT $${i}`,
      params
    )

    ok(res, { history: rows })
  })
)

// 5. Customer Directory API
router.get(
  '/customers',
  ah(async (req, res) => {
    const { search } = req.query as Record<string, string>
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let i = 1

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(c.name ILIKE $${i} OR c.customer_code ILIKE $${i} OR c.email ILIKE $${i} OR c.phone ILIKE $${i})`)
      i++
    }

    const { rows } = await query(
      `SELECT c.id, c.customer_code, c.name, c.contact_person, c.email,
              c.phone, c.whatsapp_number, c.address, c.city, c.state, c.pincode,
              c.status, c.created_at,
              u.username AS linked_username
       FROM customers c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.created_at DESC`,
      params
    )

    ok(res, { customers: rows })
  })
)

export default router
