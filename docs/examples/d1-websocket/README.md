# D1 + WebSocket Template

Real-time WebSocket server using `refine-sqlx` with Cloudflare Durable Objects.

## Features

- ✅ WebSocket connections with Durable Objects
- ✅ Real-time data updates
- ✅ Pub/Sub pattern for broadcasting
- ✅ Connection state management
- ✅ Automatic reconnection
- ✅ Room/channel support
- ✅ Presence tracking

## Quick Start

```bash
npm install
npx wrangler d1 create my-websocket-db
npm run db:migrate
npm run dev
```

Connect to ws://localhost:8787/ws

## WebSocket Events

### Client → Server

```typescript
// Join room
{ type: 'join', room: 'users' }

// Subscribe to resource updates
{ type: 'subscribe', resource: 'users', filters: { status: 'active' } }

// Send message
{ type: 'message', room: 'users', data: { text: 'Hello' } }
```

### Server → Client

```typescript
// Data update
{ type: 'update', resource: 'users', action: 'create', data: { ... } }

// Broadcast message
{ type: 'message', room: 'users', from: 'userId', data: { ... } }

// Presence update
{ type: 'presence', room: 'users', users: [...] }
```

## Example Usage

### JavaScript Client

```javascript
const ws = new WebSocket('ws://localhost:8787/ws');

ws.onopen = () => {
  // Join room
  ws.send(JSON.stringify({ type: 'join', room: 'users' }));

  // Subscribe to updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    resource: 'users',
    filters: { status: 'active' }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'update') {
    console.log('Data updated:', message);
  }
};
```

### React Hook

```typescript
import { useWebSocket } from './hooks/useWebSocket';

function UsersList() {
  const { data, subscribe, send } = useWebSocket('ws://localhost:8787/ws');

  useEffect(() => {
    subscribe('users', { status: 'active' });
  }, []);

  return (
    <div>
      {data.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

## Durable Objects

### Connection Handler

```typescript
export class WebSocketRoom {
  state: DurableObjectState;
  sessions: Set<WebSocket>;

  async fetch(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleSession(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(websocket: WebSocket) {
    websocket.accept();
    this.sessions.add(websocket);

    websocket.addEventListener('message', async (event) => {
      const message = JSON.parse(event.data);
      await this.handleMessage(websocket, message);
    });
  }

  async broadcast(message: any) {
    const data = JSON.stringify(message);
    this.sessions.forEach(session => session.send(data));
  }
}
```

## Features

### Room Management

```typescript
// Join/leave rooms
ws.send({ type: 'join', room: 'chat-room-1' });
ws.send({ type: 'leave', room: 'chat-room-1' });
```

### Presence Tracking

```typescript
// Track online users in room
ws.send({ type: 'presence', room: 'users' });

// Response:
{
  type: 'presence',
  room: 'users',
  users: [
    { id: 1, name: 'John', status: 'online' },
    { id: 2, name: 'Jane', status: 'away' }
  ]
}
```

### Real-time CRUD

```typescript
// Server broadcasts on data changes
await dataProvider.create({
  resource: 'users',
  variables: { name: 'New User' }
});

// All subscribed clients receive:
{
  type: 'update',
  resource: 'users',
  action: 'create',
  data: { id: 123, name: 'New User', ... }
}
```

## Deployment

```bash
# Configure Durable Objects in wrangler.toml
[durable_objects]
bindings = [
  { name = "WEBSOCKET_ROOM", class_name = "WebSocketRoom" }
]

[[migrations]]
tag = "v1"
new_classes = ["WebSocketRoom"]

# Deploy
npm run deploy
```

## Resources

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [refine-sqlx Documentation](../../../README.md)

## License

MIT
