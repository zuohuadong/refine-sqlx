/**
 * Seed data for tests
 */
import type { InferInsertModel } from 'drizzle-orm';
import type { comments, posts, users } from './schema';

export type UserInsert = InferInsertModel<typeof users>;
export type PostInsert = InferInsertModel<typeof posts>;
export type CommentInsert = InferInsertModel<typeof comments>;

export const seedUsers: UserInsert[] = [
  {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 25,
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
  {
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 30,
    status: 'active',
    createdAt: new Date('2024-01-02'),
  },
  {
    name: 'Carol Williams',
    email: 'carol@example.com',
    age: 35,
    status: 'inactive',
    createdAt: new Date('2024-01-03'),
  },
  {
    name: 'David Brown',
    email: 'david@example.com',
    age: 28,
    status: 'pending',
    createdAt: new Date('2024-01-04'),
  },
  {
    name: 'Eve Davis',
    email: 'eve@example.com',
    age: 32,
    status: 'active',
    createdAt: new Date('2024-01-05'),
  },
];

export const seedPosts: Omit<PostInsert, 'userId'>[] = [
  {
    title: 'First Post',
    content: 'This is the first post content',
    published: true,
    viewCount: 100,
    createdAt: new Date('2024-02-01'),
  },
  {
    title: 'Second Post',
    content: 'This is the second post content',
    published: true,
    viewCount: 50,
    createdAt: new Date('2024-02-02'),
  },
  {
    title: 'Draft Post',
    content: 'This is a draft post',
    published: false,
    viewCount: 0,
    createdAt: new Date('2024-02-03'),
  },
];

export const seedComments: Omit<CommentInsert, 'postId' | 'userId'>[] = [
  { content: 'Great post!', createdAt: new Date('2024-03-01') },
  { content: 'Very informative', createdAt: new Date('2024-03-02') },
  { content: 'Thanks for sharing', createdAt: new Date('2024-03-03') },
];
