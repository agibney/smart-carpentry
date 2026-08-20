import { pgTable, uuid, text, timestamp, date, numeric } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Tenant root. Most business-owned tables below carry a business_id FK — see
// docs/requirements.md "Decision: multi-tenant from the start". V1 only ever seeds one
// row here (see migrations/0001_add_multi_tenancy.sql), but every query is scoped through
// it from day one via src/lib/tenant.ts so real multi-business auth can slot in later
// without touching query logic. Two exceptions: `materials` is a shared reference catalog,
// not owned by any one business (see its own comment below), and `users.businessId` is
// nullable for the same reason `userType` exists — a global user isn't scoped to a business.
export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Kept in sync by hand with web/app/lib/types.ts's equivalent (same deliberate non-sharing
// as that file's own header comment: the frontend depends on the wire contract, not this
// ORM type, so the two lists don't import from one another). No web consumer yet — add the
// mirror there once a users UI exists, same as was done for bids/projects.
export const USER_TYPES = ['business', 'global'] as const

export type UserType = (typeof USER_TYPES)[number]

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Nullable — null when userType is 'global' (an admin/staff user not scoped to one business).
  businessId: uuid('business_id').references(() => businesses.id),
  userType: text('user_type').notNull(),
  role: text('role'),
  name: text('name').notNull(),
  email: text('email'),
  preferredLanguage: text('preferred_language'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  name: text('name').notNull(),
  phoneEncrypted: text('phone_encrypted'),
  emailEncrypted: text('email_encrypted'),
  addressEncrypted: text('address_encrypted'),
  notes: text('notes'),
  preferredLanguage: text('preferred_language'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Kept in sync by hand with web/app/lib/types.ts's PROJECT_STATUSES (same deliberate
// non-sharing as that file's own header comment: the frontend depends on the wire
// contract, not this ORM type, so the two lists don't import from one another).
export const PROJECT_STATUSES = ['lead', 'quoted', 'active', 'completed', 'cancelled'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('lead'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Shared reference catalog (pricing lookups) — deliberately not business-owned, so no
// business_id here unlike the rest of this file. See docs/requirements.md's pricing plans.
export const materials = pgTable('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  source: text('source'),
  unit: text('unit'),
  cachedPrice: numeric('cached_price', { precision: 10, scale: 2 }),
  priceUpdatedAt: timestamp('price_updated_at'),
})

// Kept in sync by hand with web/app/lib/types.ts's BID_STATUSES (same deliberate
// non-sharing as that file's own header comment: the frontend depends on the wire
// contract, not this ORM type, so the two lists don't import from one another).
export const BID_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const

export type BidStatus = (typeof BID_STATUSES)[number]

export const bids = pgTable('bids', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  status: text('status').notNull().default('draft'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const bidLineItems = pgTable('bid_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  bidId: uuid('bid_id').references(() => bids.id).notNull(),
  // Nullable — a line item can point at a materials catalog entry, or just stand alone as a
  // free-text/custom item (description + quantity + price with no catalog reference).
  materialId: uuid('material_id').references(() => materials.id),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit'),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  category: text('category'),
})

export const subcontractors = pgTable('subcontractors', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  name: text('name').notNull(),
  trade: text('trade'),
  phoneEncrypted: text('phone_encrypted'),
  rate: numeric('rate', { precision: 10, scale: 2 }),
})

export const projectSubcontractors = pgTable('project_subcontractors', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  subcontractorId: uuid('subcontractor_id').references(() => subcontractors.id).notNull(),
  role: text('role'),
  agreedRate: numeric('agreed_rate', { precision: 10, scale: 2 }),
})

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  type: text('type').notNull(),
  storageKey: text('storage_key').notNull(),
  caption: text('caption'),
  scrubStatus: text('scrub_status'),
  validatedAt: timestamp('validated_at'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
})

// Relations (enables Drizzle's relational query API, e.g. db.query.projects.findMany({ with: { bids: true } }))
export const businessesRelations = relations(businesses, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  projects: many(projects),
  bids: many(bids),
  subcontractors: many(subcontractors),
  attachments: many(attachments),
}))

export const usersRelations = relations(users, ({ one }) => ({
  business: one(businesses, { fields: [users.businessId], references: [businesses.id] }),
}))

export const clientsRelations = relations(clients, ({ one, many }) => ({
  business: one(businesses, { fields: [clients.businessId], references: [businesses.id] }),
  projects: many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  business: one(businesses, { fields: [projects.businessId], references: [businesses.id] }),
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  bids: many(bids),
  subcontractors: many(projectSubcontractors),
  attachments: many(attachments),
}))

export const materialsRelations = relations(materials, ({ many }) => ({
  lineItems: many(bidLineItems),
}))

export const bidsRelations = relations(bids, ({ one, many }) => ({
  business: one(businesses, { fields: [bids.businessId], references: [businesses.id] }),
  project: one(projects, { fields: [bids.projectId], references: [projects.id] }),
  lineItems: many(bidLineItems),
}))

export const bidLineItemsRelations = relations(bidLineItems, ({ one }) => ({
  bid: one(bids, { fields: [bidLineItems.bidId], references: [bids.id] }),
  material: one(materials, { fields: [bidLineItems.materialId], references: [materials.id] }),
}))

export const subcontractorsRelations = relations(subcontractors, ({ one, many }) => ({
  business: one(businesses, { fields: [subcontractors.businessId], references: [businesses.id] }),
  projects: many(projectSubcontractors),
}))

export const projectSubcontractorsRelations = relations(projectSubcontractors, ({ one }) => ({
  project: one(projects, { fields: [projectSubcontractors.projectId], references: [projects.id] }),
  subcontractor: one(subcontractors, { fields: [projectSubcontractors.subcontractorId], references: [subcontractors.id] }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  business: one(businesses, { fields: [attachments.businessId], references: [businesses.id] }),
  project: one(projects, { fields: [attachments.projectId], references: [projects.id] }),
}))
