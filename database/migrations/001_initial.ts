import type { Knex } from 'knex';
export async function up(db: Knex) {
  await db.schema.createTable('users', (t) => {
    t.string('id', 36).primary();
    t.string('name', 100).notNullable();
    t.string('username', 60).notNullable().unique();
    t.string('email', 190).unique();
    t.boolean('email_verified').defaultTo(false);
    t.string('password_hash', 255).notNullable();
    t.string('role', 20).notNullable().defaultTo('student');
    t.string('status', 20).notNullable().defaultTo('pending');
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('classes', (t) => {
    t.string('id', 36).primary();
    t.string('name', 100).notNullable();
    t.string('programme', 80).notNullable();
    t.string('year', 30).notNullable();
    t.integer('expected_count').notNullable();
    t.boolean('archived').defaultTo(false);
    t.unique(['name', 'year']);
  });
  await db.schema.createTable('class_staff', (t) => {
    t.string('class_id', 36).references('id').inTable('classes');
    t.string('user_id', 36).references('id').inTable('users');
    t.primary(['class_id', 'user_id']);
  });
  await db.schema.createTable('applications', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable().unique().references('id').inTable('users');
    t.string('class_id', 36).notNullable().references('id').inTable('classes');
    t.string('claimed_number', 80).notNullable().index();
    t.string('status', 20).defaultTo('pending');
    t.text('reason');
    t.string('evidence', 255);
    t.string('reviewer_id', 36);
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('student_identifiers', (t) => {
    t.string('number', 80).primary();
    t.string('user_id', 36).notNullable().unique().references('id').inTable('users');
  });
  await db.schema.createTable('enrolments', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable().references('id').inTable('users');
    t.string('class_id', 36).notNullable().references('id').inTable('classes');
    t.bigInteger('ended_at');
    t.index(['user_id', 'ended_at']);
  });
  await db.schema.createTable('sessions', (t) => {
    t.string('hash', 64).primary();
    t.string('user_id', 36).references('id').inTable('users');
    t.string('csrf', 64).notNullable();
    t.bigInteger('expires_at').notNullable();
    t.bigInteger('last_seen').notNullable();
  });
  await db.schema.createTable('tokens', (t) => {
    t.string('hash', 64).primary();
    t.string('user_id', 36);
    t.string('kind', 20).notNullable();
    t.text('payload');
    t.bigInteger('expires_at').notNullable();
  });
  await db.schema.createTable('conversations', (t) => {
    t.string('id', 36).primary();
    t.string('type', 20).notNullable();
    t.string('title', 100).notNullable();
    t.string('class_id', 36).unique().references('id').inTable('classes');
    t.string('pair_key', 80).unique();
    t.string('owner_id', 36);
    t.boolean('archived').defaultTo(false);
    t.integer('sequence').defaultTo(0);
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('members', (t) => {
    t.string('conversation_id', 36).references('id').inTable('conversations');
    t.string('user_id', 36).references('id').inTable('users');
    t.integer('joined_sequence').defaultTo(0);
    t.integer('read_sequence').defaultTo(0);
    t.bigInteger('left_at');
    t.primary(['conversation_id', 'user_id']);
  });
  await db.schema.createTable('invitations', (t) => {
    t.string('id', 36).primary();
    t.string('conversation_id', 36).references('id').inTable('conversations');
    t.string('sender_id', 36).references('id').inTable('users');
    t.string('recipient_id', 36).references('id').inTable('users');
    t.string('status', 20).defaultTo('pending');
    t.unique(['conversation_id', 'recipient_id']);
  });
  await db.schema.createTable('messages', (t) => {
    t.string('id', 36).primary();
    t.string('conversation_id', 36).notNullable().references('id').inTable('conversations');
    t.string('sender_id', 36).notNullable().references('id').inTable('users');
    t.string('client_id', 36).notNullable();
    t.string('payload_hash', 64).notNullable();
    t.integer('sequence').notNullable();
    t.text('body').notNullable();
    t.string('reply_to', 36);
    t.bigInteger('created_at').notNullable();
    t.bigInteger('edited_at');
    t.bigInteger('deleted_at');
    t.unique(['sender_id', 'client_id']);
    t.unique(['conversation_id', 'sequence']);
  });
  await db.schema.createTable('announcements', (t) => {
    t.string('id', 36).primary();
    t.string('publisher_id', 36).references('id').inTable('users');
    t.string('class_id', 36).references('id').inTable('classes');
    t.string('title', 120).notNullable();
    t.text('body').notNullable();
    t.string('priority', 20).defaultTo('normal');
    t.integer('revision').defaultTo(1);
    t.string('status', 20).defaultTo('draft');
    t.boolean('requires_ack').defaultTo(false);
    t.bigInteger('expires_at');
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('announcement_revisions', (t) => {
    t.string('announcement_id', 36).references('id').inTable('announcements');
    t.integer('revision');
    t.text('content').notNullable();
    t.bigInteger('published_at');
    t.primary(['announcement_id', 'revision']);
  });
  await db.schema.createTable('recipients', (t) => {
    t.string('announcement_id', 36).references('id').inTable('announcements');
    t.integer('revision');
    t.string('user_id', 36).references('id').inTable('users');
    t.bigInteger('acknowledged_at');
    t.primary(['announcement_id', 'revision', 'user_id']);
  });
  await db.schema.createTable('attachments', (t) => {
    t.string('id', 36).primary();
    t.string('uploader_id', 36).references('id').inTable('users');
    t.string('name', 190).notNullable();
    t.string('mime', 100).notNullable();
    t.integer('size').notNullable();
    t.string('message_id', 36).references('id').inTable('messages');
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('blocks', (t) => {
    t.string('user_id', 36).references('id').inTable('users');
    t.string('target_id', 36).references('id').inTable('users');
    t.primary(['user_id', 'target_id']);
  });
  await db.schema.createTable('reports', (t) => {
    t.string('id', 36).primary();
    t.string('reporter_id', 36).references('id').inTable('users');
    t.string('message_id', 36).references('id').inTable('messages');
    t.string('class_id', 36);
    t.text('reason').notNullable();
    t.text('evidence').notNullable();
    t.string('status', 20).defaultTo('open');
    t.text('resolution');
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('notifications', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).references('id').inTable('users');
    t.string('title', 190).notNullable();
    t.string('link', 190);
    t.boolean('is_read').defaultTo(false);
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('audit_logs', (t) => {
    t.string('id', 36).primary();
    t.string('actor_id', 36);
    t.string('action', 100).notNullable();
    t.string('target_id', 190);
    t.text('detail');
    t.bigInteger('created_at').notNullable();
  });
  await db.schema.createTable('outbox', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable();
    t.string('event', 60).notNullable();
    t.bigInteger('created_at').notNullable();
    t.bigInteger('delivered_at');
  });
}
export async function down() {
  throw new Error(
    'Use a reviewed backup/restore plan; destructive rollback is intentionally disabled.',
  );
}
