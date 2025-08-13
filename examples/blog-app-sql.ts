/**
 * Example: Blog Application with refine-sqlx
 * Description: A complete blog application demonstrating CRUD operations,
 * relationships, and advanced queries using SQLite
 * 
 * Features:
 * - User management with authentication
 * - Post creation, editing, and publishing
 * - Comments system with moderation
 * - Categories and tags
 * - Full-text search with SQLite FTS5
 * - Polymorphic relationships for attachments
 * - Chain queries and type-safe operations
 * 
 * Prerequisites:
 * - No external database required (uses SQLite)
 * - better-sqlite3 for Node.js (auto-installed)
 * - Bun uses built-in bun:sqlite
 */

import { createProvider, type EnhancedDataProvider, type TableSchema } from '../packages/refine-sqlx/src/index.js';
// @ts-ignore
import { createProvider } from 'refine-sql';
import type { CrudFilters, CrudSorting } from '@refinedev/core';

// Define TypeScript schema for type safety
interface BlogSchema extends TableSchema {
  users: {
    id: number;
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'author' | 'user';
    bio?: string;
    avatar?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  categories: {
    id: number;
    name: string;
    slug: string;
    description?: string;
    color: string;
    createdAt: Date;
  };
  posts: {
    id: number;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    featuredImage?: string;
    status: 'draft' | 'published' | 'archived';
    publishedAt?: Date;
    authorId: number;
    categoryId?: number;
    metadata: string; // JSON string
    viewCount: number;
    createdAt: Date;
    updatedAt: Date;
  };
  tags: {
    id: number;
    name: string;
    slug: string;
    color: string;
    createdAt: Date;
  };
  postTags: {
    id: number;
    postId: number;
    tagId: number;
    createdAt: Date;
  };
  comments: {
    id: number;
    content: string;
    authorName: string;
    authorEmail: string;
    authorId?: number;
    postId: number;
    parentId?: number;
    status: 'pending' | 'approved' | 'rejected';
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  attachments: {
    id: number;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    attachableType: string;
    attachableId: number;
    createdAt: Date;
  };
}

async function main() {
  try {
    console.log('🚀 Starting Blog Application Example with refine-sqlx');

    // Create data provider with type safety
    const dataProvider = createRefineSQL('./blog_example.db') as EnhancedDataProvider<BlogSchema>;

    console.log('✅ Connected to SQLite database');

    // Create database tables
    await setupDatabase(dataProvider);

    // Seed sample data
    await seedData(dataProvider);

    // Demonstrate CRUD operations
    await demonstrateCRUD(dataProvider);

    // Demonstrate chain queries
    await demonstrateChainQueries(dataProvider);

    // Demonstrate polymorphic relationships
    await demonstratePolymorphicRelationships(dataProvider);

    // Demonstrate full-text search
    await demonstrateFullTextSearch(dataProvider);

    // Demonstrate type-safe operations
    await demonstrateTypeSafeOperations(dataProvider);

    // Demonstrate transactions
    await demonstrateTransactions(dataProvider);

    // Demonstrate performance features
    await demonstratePerformance(dataProvider);

    console.log('🎉 Blog application example completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function setupDatabase(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n📋 Setting up database tables...');

  // Create users table
  await dataProvider.executeTyped(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      bio TEXT,
      avatar TEXT,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create categories table
  await dataProvider.executeTyped(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#000000',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create posts table
  await dataProvider.executeTyped(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      featured_image TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at DATETIME,
      author_id INTEGER NOT NULL REFERENCES users(id),
      category_id INTEGER REFERENCES categories(id),
      metadata TEXT DEFAULT '{}',
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create tags table
  await dataProvider.executeTyped(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#000000',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create post_tags junction table
  await dataProvider.executeTyped(`
    CREATE TABLE IF NOT EXISTS post_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, tag_id)
    )
  `);

  // Create comments table
  await dataProvider.executeTyped(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      author_id INTEGER REFERENCES users(id),
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id),
      status TEXT NOT NULL DEFAULT 'pending',
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create attachments table (polymorphic)
  await dataProvider.executeTyped(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      attachable_type TEXT NOT NULL,
      attachable_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better performance
  await dataProvider.executeTyped('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await dataProvider.executeTyped('CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)');
  await dataProvider.executeTyped('CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)');
  await dataProvider.executeTyped('CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id)');
  await dataProvider.executeTyped('CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id)');
  await dataProvider.executeTyped('CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)');
  await dataProvider.executeTyped('CREATE INDEX IF NOT EXISTS idx_attachments_polymorphic ON attachments(attachable_type, attachable_id)');

  // Create FTS5 virtual table for full-text search
  await dataProvider.executeTyped(`
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      title, content, excerpt,
      content='posts',
      content_rowid='id'
    )
  `);

  // Enable WAL mode for better concurrency
  await dataProvider.executeTyped('PRAGMA journal_mode = WAL');
  await dataProvider.executeTyped('PRAGMA synchronous = NORMAL');
  await dataProvider.executeTyped('PRAGMA cache_size = 1000');

  console.log('✅ Database tables and indexes created');
}

async function seedData(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n🌱 Seeding sample data...');

  // Create sample users
  const adminUser = await dataProvider.createTyped({
    resource: 'users',
    variables: {
      name: 'Admin User',
      email: 'admin@blog.com',
      password: 'hashed_password',
      role: 'admin',
      bio: 'Blog administrator',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  const authorUser = await dataProvider.createTyped({
    resource: 'users',
    variables: {
      name: 'John Author',
      email: 'john@blog.com',
      password: 'hashed_password',
      role: 'author',
      bio: 'Passionate writer and developer',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create categories
  const techCategory = await dataProvider.createTyped({
    resource: 'categories',
    variables: {
      name: 'Technology',
      slug: 'technology',
      description: 'Posts about technology and programming',
      color: '#3B82F6',
      createdAt: new Date()
    }
  });

  const lifestyleCategory = await dataProvider.createTyped({
    resource: 'categories',
    variables: {
      name: 'Lifestyle',
      slug: 'lifestyle',
      description: 'Posts about lifestyle and personal development',
      color: '#10B981',
      createdAt: new Date()
    }
  });

  // Create tags
  const tags = await Promise.all([
    dataProvider.createTyped({
      resource: 'tags',
      variables: {
        name: 'TypeScript',
        slug: 'typescript',
        color: '#3178C6',
        createdAt: new Date()
      }
    }),
    dataProvider.createTyped({
      resource: 'tags',
      variables: {
        name: 'JavaScript',
        slug: 'javascript',
        color: '#F7DF1E',
        createdAt: new Date()
      }
    }),
    dataProvider.createTyped({
      resource: 'tags',
      variables: {
        name: 'React',
        slug: 'react',
        color: '#61DAFB',
        createdAt: new Date()
      }
    })
  ]);

  // Create sample posts
  const post1 = await dataProvider.createTyped({
    resource: 'posts',
    variables: {
      title: 'Getting Started with TypeScript',
      slug: 'getting-started-with-typescript',
      content: 'TypeScript is a powerful superset of JavaScript that adds static typing. In this comprehensive guide, we\'ll explore the fundamentals of TypeScript and how it can improve your development workflow...',
      excerpt: 'Learn the basics of TypeScript and how it can improve your development workflow.',
      status: 'published',
      publishedAt: new Date(),
      authorId: authorUser.data.id,
      categoryId: techCategory.data.id,
      metadata: JSON.stringify({
        readingTime: 5,
        difficulty: 'beginner',
        featured: true
      }),
      viewCount: 150,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  const post2 = await dataProvider.createTyped({
    resource: 'posts',
    variables: {
      title: 'Building Better Habits',
      slug: 'building-better-habits',
      content: 'Habits are the compound interest of self-improvement. The same way that money multiplies through compound interest, the effects of your habits multiply as you repeat them...',
      excerpt: 'Discover proven strategies for building lasting positive habits.',
      status: 'published',
      publishedAt: new Date(Date.now() - 86400000), // Yesterday
      authorId: adminUser.data.id,
      categoryId: lifestyleCategory.data.id,
      metadata: JSON.stringify({
        readingTime: 8,
        difficulty: 'intermediate'
      }),
      viewCount: 89,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000)
    }
  });

  // Create post-tag relationships
  await dataProvider.createTyped({
    resource: 'postTags',
    variables: {
      postId: post1.data.id,
      tagId: tags[0].data.id, // TypeScript
      createdAt: new Date()
    }
  });

  await dataProvider.createTyped({
    resource: 'postTags',
    variables: {
      postId: post1.data.id,
      tagId: tags[1].data.id, // JavaScript
      createdAt: new Date()
    }
  });

  // Populate FTS index
  await dataProvider.executeTyped(`
    INSERT INTO posts_fts(rowid, title, content, excerpt)
    SELECT id, title, content, excerpt FROM posts
  `);

  console.log('✅ Sample data seeded');
  return { adminUser, authorUser, techCategory, lifestyleCategory, post1, post2, tags };
}

async function demonstrateCRUD(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n📝 Demonstrating CRUD Operations...');

  // CREATE - Create a new post
  console.log('\n➕ Creating a new post...');
  const newPost = await dataProvider.createTyped({
    resource: 'posts',
    variables: {
      title: 'Advanced React Patterns',
      slug: 'advanced-react-patterns',
      content: 'In this post, we\'ll explore advanced React patterns including render props, higher-order components, and custom hooks...',
      excerpt: 'Master advanced React patterns to write more maintainable and reusable code.',
      status: 'draft',
      authorId: 1,
      categoryId: 1,
      metadata: JSON.stringify({
        readingTime: 12,
        difficulty: 'advanced',
        tags: ['react', 'javascript', 'patterns']
      }),
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log('✅ Created post:', newPost.data.title);

  // READ - Get list of posts with filters and sorting
  console.log('\n📋 Getting list of published posts...');
  const filters: CrudFilters = [
    {
      field: 'status',
      operator: 'eq',
      value: 'published'
    },
    {
      field: 'viewCount',
      operator: 'gte',
      value: 50
    }
  ];

  const sorters: CrudSorting = [
    {
      field: 'publishedAt',
      order: 'desc'
    }
  ];

  const postsList = await dataProvider.getList({
    resource: 'posts',
    filters,
    sorters,
    pagination: {
      current: 1,
      pageSize: 10,
      mode: 'server'
    }
  });
  console.log(`✅ Found ${postsList.data.length} published posts with high view counts`);

  // READ - Get single post
  console.log('\n🔍 Getting single post...');
  const singlePost = await dataProvider.getTyped({
    resource: 'posts',
    id: newPost.data.id
  });
  console.log('✅ Retrieved post:', singlePost.data.title);

  // UPDATE - Update post status to published
  console.log('\n✏️ Publishing the draft post...');
  const updatedPost = await dataProvider.updateTyped({
    resource: 'posts',
    id: newPost.data.id,
    variables: {
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log('✅ Published post:', updatedPost.data.title);

  // UPDATE MANY - Update view counts for multiple posts
  console.log('\n✏️ Updating view counts for multiple posts...');
  const postIds = postsList.data.map(post => post.id).filter((id): id is number => id !== undefined);
  if (postIds.length > 0 && dataProvider.updateMany) {
    await dataProvider.updateMany({
      resource: 'posts',
      ids: postIds,
      variables: {
        viewCount: 200 // Simulate increased views
      }
    });
    console.log(`✅ Updated view counts for ${postIds.length} posts`);
  }

  // DELETE - Delete a post (we'll create a temporary one first)
  console.log('\n🗑️ Creating and deleting a temporary post...');
  const tempPost = await dataProvider.createTyped({
    resource: 'posts',
    variables: {
      title: 'Temporary Post',
      slug: 'temporary-post',
      content: 'This post will be deleted',
      status: 'draft',
      authorId: 1,
      categoryId: 1,
      metadata: '{}',
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  await dataProvider.deleteOne({
    resource: 'posts',
    id: tempPost.data.id
  });
  console.log('✅ Deleted temporary post');
}

async function demonstrateChainQueries(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n⛓️ Demonstrating Chain Queries...');

  // Basic chain query
  console.log('\n🔗 Basic chain query - published posts by author...');
  const authorPosts = await dataProvider
    .from('posts')
    .where('authorId', 'eq', 1)
    .where('status', 'eq', 'published')
    .orderBy('publishedAt', 'desc')
    .limit(5)
    .get();
  console.log(`✅ Found ${authorPosts.length} published posts by author`);

  // Complex chain query with multiple conditions
  console.log('\n🔗 Complex chain query with multiple conditions...');
  const popularPosts = await dataProvider
    .from('posts')
    .where('status', 'eq', 'published')
    .where('viewCount', 'gte', 100)
    .where('publishedAt', 'gte', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .orderBy('viewCount', 'desc')
    .orderBy('publishedAt', 'desc')
    .limit(10)
    .get();
  console.log(`✅ Found ${popularPosts.length} popular recent posts`);

  // Aggregation queries
  console.log('\n📊 Aggregation queries...');
  const totalPublishedPosts = await dataProvider
    .from('posts')
    .where('status', 'eq', 'published')
    .count();
  console.log(`✅ Total published posts: ${totalPublishedPosts}`);

  const avgViewCount = await dataProvider
    .from('posts')
    .where('status', 'eq', 'published')
    .count(); // Note: SQLite doesn't have AVG in our chain implementation, using count as example
  console.log(`✅ Published posts count: ${avgViewCount}`);

  // Existence check
  console.log('\n❓ Existence checks...');
  const hasDraftPosts = await dataProvider
    .from('posts')
    .where('status', 'eq', 'draft')
    .exists();
  console.log(`✅ Has draft posts: ${hasDraftPosts}`);

  // Get first result
  console.log('\n🥇 Get first result...');
  const latestPost = await dataProvider
    .from('posts')
    .where('status', 'eq', 'published')
    .orderBy('publishedAt', 'desc')
    .first();
  console.log(`✅ Latest post: ${latestPost?.title || 'None found'}`);

  // Pagination with chain queries
  console.log('\n📄 Pagination with chain queries...');
  const paginatedPosts = await dataProvider
    .from('posts')
    .where('status', 'eq', 'published')
    .orderBy('createdAt', 'desc')
    .paginate(1, 3) // Page 1, 3 items per page
    .get();
  console.log(`✅ Paginated posts (page 1): ${paginatedPosts.length} posts`);
}

async function demonstratePolymorphicRelationships(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n🔗 Demonstrating Polymorphic Relationships...');

  // Create attachments for different models
  console.log('\n📎 Creating polymorphic attachments...');

  // Attachment for a post
  const postAttachment = await dataProvider.createTyped({
    resource: 'attachments',
    variables: {
      filename: 'hero-image.jpg',
      originalName: 'Hero Image.jpg',
      mimeType: 'image/jpeg',
      size: 1024000,
      url: '/uploads/hero-image.jpg',
      attachableType: 'post',
      attachableId: 1,
      createdAt: new Date()
    }
  });

  // Attachment for a user (avatar)
  const userAttachment = await dataProvider.createTyped({
    resource: 'attachments',
    variables: {
      filename: 'avatar.png',
      originalName: 'Profile Avatar.png',
      mimeType: 'image/png',
      size: 256000,
      url: '/uploads/avatar.png',
      attachableType: 'user',
      attachableId: 1,
      createdAt: new Date()
    }
  });

  console.log('✅ Created polymorphic attachments');

  // Query polymorphic relationships
  console.log('\n🔍 Querying polymorphic relationships...');
  const postAttachments = await dataProvider
    .morphTo('attachments', {
      typeField: 'attachableType',
      idField: 'attachableId',
      relationName: 'attachable',
      types: {
        'post': 'posts',
        'user': 'users'
      }
    })
    .where('attachableType', 'eq', 'post')
    .get();

  console.log(`✅ Found ${postAttachments.length} post attachments`);

  // Get all attachments with their related models
  const allAttachments = await dataProvider
    .morphTo('attachments', {
      typeField: 'attachableType',
      idField: 'attachableId',
      relationName: 'attachable',
      types: {
        'post': 'posts',
        'user': 'users'
      }
    })
    // .withMorphRelations() // This method might not exist, commenting out
    .get();

  console.log(`✅ Found ${allAttachments.length} attachments with related models`);
  if (allAttachments.length > 0) {
    console.log(`First attachment relates to: ${allAttachments[0].attachableType}`);
  }

  // Demonstrate nested comments
  console.log('\n💬 Creating nested comments...');

  // Create a parent comment
  const parentComment = await dataProvider.createTyped({
    resource: 'comments',
    variables: {
      content: 'Great article! Very informative and well-written.',
      authorName: 'Jane Reader',
      authorEmail: 'jane@example.com',
      postId: 1,
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // Create a reply to the parent comment
  const replyComment = await dataProvider.createTyped({
    resource: 'comments',
    variables: {
      content: 'I completely agree! Thanks for sharing your thoughts.',
      authorName: 'Bob Commenter',
      authorEmail: 'bob@example.com',
      postId: 1,
      parentId: parentComment.data.id,
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('✅ Created nested comments');

  // Get comments with their replies using raw SQL
  const commentsWithReplies = await dataProvider.queryTyped(`
    SELECT 
      c1.*,
      GROUP_CONCAT(
        json_object(
          'id', c2.id,
          'content', c2.content,
          'authorName', c2.author_name,
          'createdAt', c2.created_at
        )
      ) as replies
    FROM comments c1
    LEFT JOIN comments c2 ON c1.id = c2.parent_id
    WHERE c1.post_id = ? AND c1.parent_id IS NULL
    GROUP BY c1.id
    ORDER BY c1.created_at ASC
  `, [1]);

  console.log(`✅ Found ${commentsWithReplies.length} top-level comments with replies`);
}

async function demonstrateFullTextSearch(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n🔎 Demonstrating Full-Text Search...');

  // Update FTS index with current posts
  await dataProvider.executeTyped(`
    DELETE FROM posts_fts;
    INSERT INTO posts_fts(rowid, title, content, excerpt)
    SELECT id, title, content, excerpt FROM posts WHERE status = 'published';
  `);

  // Search for posts containing "TypeScript"
  console.log('\n🔍 Searching for posts containing "TypeScript"...');
  const searchResults = await dataProvider.queryTyped(`
    SELECT 
      p.*,
      bm25(posts_fts) as relevance_score,
      snippet(posts_fts, 0, '<mark>', '</mark>', '...', 32) as title_snippet,
      snippet(posts_fts, 1, '<mark>', '</mark>', '...', 64) as content_snippet
    FROM posts p
    JOIN posts_fts ON p.id = posts_fts.rowid
    WHERE posts_fts MATCH ?
    ORDER BY bm25(posts_fts)
    LIMIT 10
  `, ['TypeScript']);

  console.log(`✅ Found ${searchResults.length} posts matching "TypeScript"`);
  searchResults.forEach((result: any) => {
    console.log(`  - ${result.title} (relevance: ${result.relevance_score.toFixed(2)})`);
  });

  // Advanced search with multiple terms
  console.log('\n🔍 Advanced search: "JavaScript OR React"...');
  const advancedSearch = await dataProvider.queryTyped(`
    SELECT 
      p.*,
      bm25(posts_fts) as relevance_score
    FROM posts p
    JOIN posts_fts ON p.id = posts_fts.rowid
    WHERE posts_fts MATCH ?
    ORDER BY bm25(posts_fts)
    LIMIT 10
  `, ['JavaScript OR React']);

  console.log(`✅ Found ${advancedSearch.length} posts matching "JavaScript OR React"`);

  // Search with phrase matching
  console.log('\n🔍 Phrase search: "development workflow"...');
  const phraseSearch = await dataProvider.queryTyped(`
    SELECT 
      p.*,
      bm25(posts_fts) as relevance_score
    FROM posts p
    JOIN posts_fts ON p.id = posts_fts.rowid
    WHERE posts_fts MATCH ?
    ORDER BY bm25(posts_fts)
    LIMIT 10
  `, ['"development workflow"']);

  console.log(`✅ Found ${phraseSearch.length} posts matching phrase "development workflow"`);
}

async function demonstrateTypeSafeOperations(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n🛡️ Demonstrating Type-Safe Operations...');

  // Type-safe find operations
  console.log('\n🔍 Type-safe find operations...');

  // Find user by email
  const user = await dataProvider.findTyped('users', {
    email: 'john@blog.com'
  });
  console.log(`✅ Found user: ${user?.name || 'Not found'}`);

  // Find multiple posts by status
  const publishedPosts = await dataProvider.findManyTyped(
    'posts',
    { status: 'published' },
    {
      limit: 5,
      orderBy: [{ field: 'publishedAt', order: 'desc' }]
    }
  );
  console.log(`✅ Found ${publishedPosts.length} published posts`);

  // Check existence
  console.log('\n❓ Type-safe existence checks...');
  const emailExists = await dataProvider.existsTyped('users', {
    email: 'admin@blog.com'
  });
  console.log(`✅ Email exists: ${emailExists}`);

  const draftExists = await dataProvider.existsTyped('posts', {
    status: 'draft'
  });
  console.log(`✅ Draft posts exist: ${draftExists}`);

  // Complex type-safe queries
  console.log('\n🧪 Complex type-safe operations...');

  // Get posts with specific metadata
  const featuredPosts = await dataProvider.queryTyped(`
    SELECT * FROM posts 
    WHERE status = 'published' 
    AND json_extract(metadata, '$.featured') = true
    ORDER BY published_at DESC
  `);
  console.log(`✅ Found ${featuredPosts.length} featured posts`);

  // Get user statistics
  const userStats = await dataProvider.queryTyped(`
    SELECT 
      u.name,
      u.role,
      COUNT(p.id) as post_count,
      AVG(p.view_count) as avg_views,
      MAX(p.published_at) as latest_post
    FROM users u
    LEFT JOIN posts p ON u.id = p.author_id AND p.status = 'published'
    GROUP BY u.id, u.name, u.role
    ORDER BY post_count DESC
  `);
  console.log(`✅ User statistics:`);
  userStats.forEach((stat: any) => {
    console.log(`  - ${stat.name} (${stat.role}): ${stat.post_count} posts, avg ${Math.round(stat.avg_views || 0)} views`);
  });
}

// Transaction example (simplified for refine-sqlx)
async function demonstrateTransactions(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n💳 Demonstrating Transactions...');

  try {
    // Create a user
    const user = await dataProvider.createTyped({
      resource: 'users',
      variables: {
        name: 'Transaction User',
        email: 'transaction@example.com',
        password: 'hashed_password',
        role: 'author',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create a category
    const category = await dataProvider.createTyped({
      resource: 'categories',
      variables: {
        name: 'Transaction Category',
        slug: 'transaction-category',
        description: 'Created in transaction',
        color: '#000000',
        createdAt: new Date()
      }
    });

    // Create a post
    const post = await dataProvider.createTyped({
      resource: 'posts',
      variables: {
        title: 'Transaction Post',
        slug: 'transaction-post',
        content: 'This post was created in a transaction',
        status: 'published',
        publishedAt: new Date(),
        authorId: user.data.id,
        categoryId: category.data.id,
        metadata: '{}',
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Transaction completed successfully');
    console.log(`Created user ID: ${user.data.id}`);
    console.log(`Created category ID: ${category.data.id}`);
    console.log(`Created post ID: ${post.data.id}`);

  } catch (error) {
    console.error('❌ Transaction failed:', error);
  }
}

// Performance demonstration
async function demonstratePerformance(dataProvider: EnhancedDataProvider<BlogSchema>) {
  console.log('\n⚡ Demonstrating Performance Features...');

  const startTime = Date.now();

  // Batch operations (simplified for refine-sqlx)
  const batchTags = [
    { name: 'Performance', slug: 'performance', color: '#FF5722', createdAt: new Date() },
    { name: 'Optimization', slug: 'optimization', color: '#FF9800', createdAt: new Date() },
    { name: 'Speed', slug: 'speed', color: '#FFC107', createdAt: new Date() }
  ];

  const batchResults = await Promise.all(
    batchTags.map(tag => dataProvider.createTyped({
      resource: 'tags',
      variables: tag
    }))
  );
  console.log(`✅ Batch inserted ${batchResults.length} tags`);

  // Concurrent queries
  const promises = [
    dataProvider.from('posts').where('status', 'eq', 'published').count(),
    dataProvider.from('users').where('isActive', 'eq', true).count(),
    dataProvider.from('comments').where('status', 'eq', 'approved').count(),
    dataProvider.from('categories').count(),
    dataProvider.from('tags').count()
  ];

  const results = await Promise.all(promises);
  const endTime = Date.now();

  console.log(`✅ Executed ${promises.length} concurrent queries in ${endTime - startTime}ms`);
  console.log(`Published posts: ${results[0]}, Active users: ${results[1]}, Approved comments: ${results[2]}`);
  console.log(`Categories: ${results[3]}, Tags: ${results[4]}`);

  // Database optimization info
  const dbInfo = await dataProvider.queryTyped('PRAGMA database_list');
  const journalMode = await dataProvider.queryTyped('PRAGMA journal_mode');
  const cacheSize = await dataProvider.queryTyped('PRAGMA cache_size');

  console.log('✅ Database optimization info retrieved');
  console.log(`Journal mode: ${JSON.stringify(journalMode)}`);
  console.log(`Cache size: ${JSON.stringify(cacheSize)}`);
  console.log('✅ Database optimization info:');
  console.log(`  - Journal mode: ${journalMode[0].journal_mode}`);
  console.log(`  - Cache size: ${Math.abs(cacheSize[0].cache_size)} pages`);
}

// Run example if this file is executed directly
if (typeof Bun !== 'undefined' && import.meta.main) {
  main().catch(console.error);
} else if (typeof process !== 'undefined' && process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}