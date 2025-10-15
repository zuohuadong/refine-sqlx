# D1 + GraphQL Template

GraphQL API using `refine-sqlx` with Cloudflare D1 and GraphQL Yoga.

## Features

- ✅ Type-safe GraphQL with code-first approach
- ✅ GraphQL Yoga for Cloudflare Workers
- ✅ Auto-generated schema from TypeScript
- ✅ DataLoader for N+1 query optimization
- ✅ Subscriptions support
- ✅ GraphQL Playground
- ✅ File uploads

## Quick Start

```bash
npm install
npx wrangler d1 create my-graphql-db
npm run db:migrate
npm run dev
```

Visit http://localhost:8787/graphql for GraphQL Playground

## GraphQL Schema

### Queries

```graphql
type Query {
  user(id: Int!): User
  users(page: Int, pageSize: Int, status: UserStatus): UsersConnection!
  post(id: Int!): Post
  posts(userId: Int, status: PostStatus): [Post!]!
}
```

### Mutations

```graphql
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: Int!, input: UpdateUserInput!): User!
  deleteUser(id: Int!): Boolean!

  createPost(input: CreatePostInput!): Post!
  updatePost(id: Int!, input: UpdatePostInput!): Post!
  publishPost(id: Int!): Post!
}
```

### Subscriptions

```graphql
type Subscription {
  userCreated: User!
  postPublished: Post!
}
```

## Example Queries

### Get User with Posts

```graphql
query GetUserWithPosts {
  user(id: 1) {
    id
    name
    email
    posts {
      id
      title
      status
      publishedAt
    }
  }
}
```

### Create User

```graphql
mutation CreateUser {
  createUser(input: {
    name: "John Doe"
    email: "john@example.com"
    status: ACTIVE
  }) {
    id
    name
    email
    createdAt
  }
}
```

### List Users with Pagination

```graphql
query ListUsers {
  users(page: 1, pageSize: 10, status: ACTIVE) {
    edges {
      node {
        id
        name
        email
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

## Project Structure

```
d1-graphql/
├── src/
│   ├── index.ts              # GraphQL Yoga server
│   ├── schema.ts             # Drizzle schema
│   ├── graphql/
│   │   ├── schema.ts         # GraphQL schema
│   │   ├── resolvers/
│   │   │   ├── users.ts      # User resolvers
│   │   │   └── posts.ts      # Post resolvers
│   │   └── types/
│   │       ├── user.ts       # User GraphQL types
│   │       └── post.ts       # Post GraphQL types
│   └── utils/
│       └── dataloader.ts     # DataLoader setup
├── package.json
└── README.md
```

## Advanced Features

### DataLoader for N+1 Prevention

```typescript
import DataLoader from 'dataloader';

const userLoader = new DataLoader(async (ids: number[]) => {
  const { data } = await dataProvider.getMany({ resource: 'users', ids });
  return ids.map(id => data.find(u => u.id === id));
});
```

### Subscriptions

```typescript
import { createPubSub } from 'graphql-yoga';

const pubsub = createPubSub();

// In mutation
pubsub.publish('userCreated', { userCreated: newUser });

// In subscription resolver
subscribe: (_, args) => pubsub.subscribe('userCreated')
```

## Resources

- [GraphQL Yoga Documentation](https://the-guild.dev/graphql/yoga-server)
- [DataLoader Documentation](https://github.com/graphql/dataloader)
- [refine-sqlx Documentation](../../../README.md)

## License

MIT
