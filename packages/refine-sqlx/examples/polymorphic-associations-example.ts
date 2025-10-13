/**
 * Polymorphic Associations Example
 *
 * This example demonstrates how to use polymorphic associations with refine-orm,
 * including one-to-many and many-to-many polymorphic relationships.
 */

import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import {
  createPostgreSQLProvider,
  createProvider,
  createMorphConfig,
  createEnhancedMorphConfig,
} from '../src/index.js';

// Define database schema
const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow(),
});

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// One-to-many polymorphic relationship: Comments can belong to posts, videos, or users
const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  commentable_type: text('commentable_type').notNull(), // 'post', 'video', 'user'
  commentable_id: integer('commentable_id').notNull(),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Many-to-many polymorphic relationship: Tags can be attached to posts, videos, or users
const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const taggables = pgTable('taggables', {
  id: serial('id').primaryKey(),
  tag_id: integer('tag_id').notNull(),
  taggable_type: text('taggable_type').notNull(), // 'post', 'video', 'user'
  taggable_id: integer('taggable_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { posts, videos, users, comments, tags, taggables };

async function polymorphicAssociationsExample() {
  // Create database connection
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://user:password@localhost:5432/refine_orm_example';
  const adapter = createPostgreSQLProvider(connectionString, schema);
  const dataProvider = createProvider(adapter);

  console.log('🚀 Polymorphic Associations Example\n');

  // Example 1: One-to-many polymorphic relationships (Comments)
  console.log('📝 Example 1: One-to-many polymorphic relationships (Comments)');

  const commentsConfig = createMorphConfig({
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', video: 'videos', user: 'users' },
  });

  try {
    // Get all comments with their polymorphic relationships loaded
    const commentsWithRelations = await dataProvider
      .from('comments')
      .limit(10)
      .get();

    console.log(
      `Found ${commentsWithRelations.length} comments with relations:`
    );
    commentsWithRelations.forEach((comment: any) => {
      console.log(`- Comment: "${comment.content}"`);
      console.log(
        `  Commentable: ${comment.commentable_type} #${comment.commentable_id}`
      );
      if (comment.commentable) {
        console.log(`  Related data:`, comment.commentable);
      }
      console.log('');
    });

    // Get comments for specific type only
    const postComments = await dataProvider
      .from('comments')
      .where('commentable_type', 'eq', 'post')
      .get();

    console.log(`Found ${postComments.length} post comments\n`);

    // Get comments for multiple types
    const mediaComments = await dataProvider
      .from('comments')
      .where('commentable_type', 'in', ['post', 'video'])
      .get();

    console.log(`Found ${mediaComments.length} media comments\n`);
  } catch (error) {
    console.error('Error in one-to-many example:', error);
  }

  // Example 2: Many-to-many polymorphic relationships (Tags)
  console.log('🏷️  Example 2: Many-to-many polymorphic relationships (Tags)');

  const tagsConfig = createEnhancedMorphConfig({
    typeField: 'taggable_type',
    idField: 'taggable_id',
    relationName: 'taggables',
    types: { post: 'posts', video: 'videos', user: 'users' },
    pivotTable: 'taggables',
    pivotLocalKey: 'tag_id',
    pivotForeignKey: 'taggable_id',
  });

  try {
    // Get all tags with their many-to-many polymorphic relationships
    const tagsWithRelations = await dataProvider.from('tags').get();

    console.log(`Found ${tagsWithRelations.length} tags with relations:`);
    tagsWithRelations.forEach((tag: any) => {
      console.log(`- Tag: "${tag.name}"`);
      if (tag.taggables && Array.isArray(tag.taggables)) {
        console.log(`  Tagged items: ${tag.taggables.length}`);
        tag.taggables.forEach((item: any) => {
          console.log(
            `    - ${item._pivot?.taggable_type} #${item._pivot?.taggable_id}`
          );
        });
      }
      console.log('');
    });
  } catch (error) {
    console.error('Error in many-to-many example:', error);
  }

  // Example 3: Nested polymorphic relationships
  console.log('🔗 Example 3: Nested polymorphic relationships');

  const nestedConfig = createEnhancedMorphConfig({
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', video: 'videos', user: 'users' },
    nested: true,
    nestedRelations: {
      tags: {
        typeField: 'taggable_type',
        idField: 'taggable_id',
        relationName: 'tags',
        types: { post: 'posts', video: 'videos', user: 'users' },
      },
    },
  });

  try {
    // Get comments with nested polymorphic relationships (commentable -> tags)
    const commentsWithNested = await dataProvider.from('comments').get();

    console.log(
      `Found ${commentsWithNested.length} comments with nested relations:`
    );
    commentsWithNested.forEach((comment: any) => {
      console.log(`- Comment: "${comment.content}"`);
      if (comment.commentable) {
        console.log(`  Commentable:`, comment.commentable);
        if ((comment.commentable as any).tags) {
          console.log(`  Tags:`, (comment.commentable as any).tags);
        }
      }
      console.log('');
    });
  } catch (error) {
    console.error('Error in nested example:', error);
  }

  // Example 4: Custom loader for complex polymorphic relationships
  console.log('⚙️  Example 4: Custom loader for complex relationships');

  const customLoaderConfig = createEnhancedMorphConfig({
    typeField: 'commentable_type',
    idField: 'commentable_id',
    relationName: 'commentable',
    types: { post: 'posts', video: 'videos', user: 'users' },
    customLoader: async (_client, baseResults, config) => {
      // Custom logic to load relationships with additional processing
      const relationData: Record<string, any> = {};

      for (let i = 0; i < baseResults.length; i++) {
        const result = baseResults[i];
        const morphType = result[config.typeField];
        const morphId = result[config.idField];

        // Add custom processing logic here
        relationData[i] = {
          type: morphType,
          id: morphId,
          customField: `Custom data for ${morphType} #${morphId}`,
          loadedAt: new Date(),
        };
      }

      return relationData;
    },
  });

  try {
    const commentsWithCustomLoader = await dataProvider.from('comments').get();

    console.log(
      `Found ${commentsWithCustomLoader.length} comments with custom loader:`
    );
    commentsWithCustomLoader.forEach((comment: any) => {
      console.log(`- Comment: "${comment.content}"`);
      console.log(`  Custom data:`, comment.commentable);
      console.log('');
    });
  } catch (error) {
    console.error('Error in custom loader example:', error);
  }

  // Example 5: Type-safe polymorphic queries with filtering
  console.log('🔍 Example 5: Type-safe polymorphic queries with filtering');

  try {
    // Complex query with multiple conditions
    const filteredComments = await dataProvider
      .from('comments')
      .where('userId', 'eq', 1)
      .where('commentable_type', 'in', ['post', 'video'])
      .orderBy('createdAt', 'desc')
      .paginate(1, 5)
      .get();

    console.log(`Found ${filteredComments.length} filtered comments`);

    // Get count of comments by type
    const postCommentsCount = await dataProvider
      .from('comments')
      .where('commentable_type', 'eq', 'post')
      .count();

    console.log(`Total post comments: ${postCommentsCount}`);

    // Get first comment of specific type
    const firstVideoComment = await dataProvider
      .from('comments')
      .where('commentable_type', 'eq', 'video')
      .orderBy('createdAt', 'desc')
      .first();

    if (firstVideoComment) {
      console.log(`Latest video comment: "${firstVideoComment.content}"`);
    }
  } catch (error) {
    console.error('Error in filtering example:', error);
  }

  console.log('✅ Polymorphic associations example completed!');
}

// Example usage with error handling
async function runExample() {
  try {
    await polymorphicAssociationsExample();
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExample();
}

export { polymorphicAssociationsExample };
