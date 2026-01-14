# MetaMCP Threads

A Model Context Protocol (MCP) server for the Threads API.

## Installation

```bash
npm install @meta-mcp/threads
# or
pnpm add @meta-mcp/threads
```

## Configuration

This package requires the following environment variables:

- `THREADS_ACCESS_TOKEN`: Access Token for the Threads user.
- `THREADS_USER_ID`: The Threads User ID.

## Usage

```typescript
import { ThreadsManager, createToolRegistry } from "@meta-mcp/threads";

const manager = ThreadsManager.fromEnv();
const registry = createToolRegistry(manager);
```

## Available Tools

### Posting
- **th_post_thread**: Publish a new thread.
  - Supports `TEXT`, `IMAGE`, `VIDEO` media types.
  - Options: `reply_control` (everyone, accounts_you_follow, mentioned_only), `link_attachment`, `quote_post_id`.

### Retrieval
- **th_get_user_threads**: Get a list of threads published by the user.
  - Inputs: `limit` (default 25).

### Insights
- **th_get_user_insights**: specific account insights.
- **th_get_publishing_limit**: Check current publishing quota and rate limits.
