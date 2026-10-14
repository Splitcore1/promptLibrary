import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const prompts = sqliteTable('prompts', {
 id: text('id').primaryKey(), owner: text('owner').notNull(),
 data: text('data').notNull(), version: integer('version').notNull().default(1),
 createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('prompts_owner').on(t.owner)]);
export const collections = sqliteTable('collections', {
 id: text('id').primaryKey(), owner: text('owner').notNull(),
 name: text('name').notNull(), color: text('color').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('collections_owner').on(t.owner)]);
export const revisions = sqliteTable('revisions', {
 id: text('id').primaryKey(), promptId: text('prompt_id').notNull().references(() => prompts.id, {onDelete:'cascade'}),
 owner: text('owner').notNull(), data: text('data').notNull(),
 version: integer('version').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('revisions_prompt').on(t.promptId)]);
export const assets = sqliteTable('assets', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), key: text('key').notNull(),
 name: text('name').notNull(), mime: text('mime').notNull(),
 size: integer('size').notNull(), createdAt: text('created_at').notNull(),
}, t => [index('assets_owner').on(t.owner)]);

