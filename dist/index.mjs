// src/manager.ts
import { GraphApiClient, graphConfig } from "@meta-mcp/core";
var ThreadsManager = class _ThreadsManager {
  client;
  userId;
  accessToken;
  baseUrl = "https://graph.threads.net/v1.0";
  // Threads uses v1.0 currently
  constructor(client, userId, accessToken) {
    this.client = client;
    this.userId = userId;
    this.accessToken = accessToken;
  }
  static fromEnv() {
    if (!graphConfig.threadsUserId || !graphConfig.threadsAccessToken) {
      throw new Error("THREADS_USER_ID or THREADS_ACCESS_TOKEN is not configured");
    }
    return new _ThreadsManager(
      new GraphApiClient(graphConfig),
      graphConfig.threadsUserId,
      graphConfig.threadsAccessToken
    );
  }
  async request(endpoint, method, params) {
    return this.client.request({
      method,
      endpoint,
      params,
      baseUrl: this.baseUrl,
      accessToken: this.accessToken
    });
  }
  async postThread(text, mediaType = "TEXT", mediaUrl, options = {}) {
    if (mediaType === "TEXT" && !text) {
      throw new Error("Text is required for TEXT media type");
    }
    const creationParams = {
      media_type: mediaType,
      text,
      ...options
    };
    if (mediaUrl) {
      creationParams[mediaType === "IMAGE" ? "image_url" : "video_url"] = mediaUrl;
    }
    const container = await this.request(
      "me/threads",
      "POST",
      creationParams
    );
    if (!container.id) {
      throw new Error("Failed to create threads container");
    }
    return this.publishThread(container.id);
  }
  async postCarousel(items, text) {
    const childrenIds = [];
    for (const item of items) {
      const itemParams = {
        media_type: item.media_type,
        is_carousel_item: true
      };
      if (item.media_type === "IMAGE") itemParams.image_url = item.url;
      if (item.media_type === "VIDEO") itemParams.video_url = item.url;
      if (item.alt_text) itemParams.alt_text = item.alt_text;
      const container2 = await this.request("me/threads", "POST", itemParams);
      if (container2.id) childrenIds.push(container2.id);
    }
    if (childrenIds.length === 0) {
      throw new Error("Failed to create carousel items");
    }
    const creationParams = {
      media_type: "CAROUSEL",
      children: childrenIds.join(",")
      // Threads API expects comma-separated string or array? Usually array/string. Graph API v19+ often accepts array, but let's check. 
      // IG uses array of IDs. Let's send array first (client.request stringifies it if needed? No, usually not).
      // But wait, `children` is usually a list of IDs.
      // Let's assume comma-separated string for safety if it enters query params, or array if JSON body.
      // Since `batchRequest` logic in core suggests JSON body, Array is likely correct.
      // However, `request` method in `ThreadsManager` passes params. `GraphApiClient` puts params in query string for GET, 
      // and usually body for POST?
      // `GraphApiClient` implementation: if method is POST and body is provided, it uses body. If params provided, it uses params (query string).
      // `ThreadsManager.request` passes `params`. `GraphApiClient` treats `params` as URLSearchParams.
      // URLSearchParams does NOT handle arrays well (it repeats keys `children=1&children=2`).
      // Meta APIs often want `children` as a comma-separated string in query params.
    };
    creationParams.children = childrenIds.join(",");
    if (text) creationParams.text = text;
    const container = await this.request("me/threads", "POST", creationParams);
    return this.publishThread(container.id);
  }
  async getReplies(mediaId, limit = 25, cursor) {
    return this.request(
      `${mediaId}/replies`,
      "GET",
      {
        fields: "id,text,username,timestamp,like_count,reply_count",
        limit,
        after: cursor
      }
    );
  }
  async replyToThread(mediaId, text) {
    return this.postThread(text, "TEXT", void 0, { reply_to_id: mediaId });
  }
  async publishThread(creationId) {
    return this.request(
      `${this.userId}/threads_publish`,
      "POST",
      { creation_id: creationId }
    );
  }
  async getUserThreads(limit = 25) {
    const response = await this.request(
      `${this.userId}/threads`,
      "GET",
      {
        fields: "id,text,media_type,media_url,permalink,timestamp,like_count,reply_count",
        limit
      }
    );
    return response.data;
  }
  async getUserInsights() {
    const response = await this.request(
      `${this.userId}/threads_insights`,
      "GET",
      {
        metric: "views,likes,replies,reposts,quotes",
        // Example metrics
        period: "day"
      }
    );
    return response.data;
  }
  async getPublishingLimit() {
    const response = await this.request(
      `${this.userId}/threads_publishing_limit`,
      "GET",
      {
        fields: "quota_usage,config,reply_quota_usage,reply_config"
      }
    );
    return response.data;
  }
};

// src/toolSchemas.ts
import { z } from "zod";
var toolSchemas = {
  th_post_thread: z.object({
    text: z.string().optional().describe("Text content of the thread. Required if media_type is TEXT."),
    media_type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
    media_url: z.string().url().optional(),
    reply_control: z.enum(["everyone", "accounts_you_follow", "mentioned_only"]).optional().describe("Who can reply to this thread"),
    quote_post_id: z.string().optional().describe("ID of a post to quote"),
    link_attachment: z.string().url().optional().describe("URL to attach"),
    alt_text: z.string().optional().describe("Alt text for media")
  }),
  th_get_user_threads: z.object({
    limit: z.number().int().min(1).max(50).optional().default(25)
  }),
  th_post_photo: z.object({
    url: z.string().url().describe("Image URL"),
    text: z.string().optional().describe("Caption text"),
    alt_text: z.string().optional().describe("Alt text for the image")
  }),
  th_post_video: z.object({
    url: z.string().url().describe("Video URL"),
    text: z.string().optional().describe("Caption text"),
    alt_text: z.string().optional().describe("Alt text for the video")
  }),
  th_post_carousel: z.object({
    items: z.array(z.object({
      url: z.string().url(),
      media_type: z.enum(["IMAGE", "VIDEO"]),
      alt_text: z.string().optional()
    })).min(2).max(10).describe("List of media items (images/videos)"),
    text: z.string().optional().describe("Caption for the carousel")
  }),
  th_get_replies: z.object({
    media_id: z.string().describe("Thread/Media ID to get replies for"),
    limit: z.number().int().optional().default(25),
    cursor: z.string().optional()
  }),
  th_reply: z.object({
    media_id: z.string().describe("Thread/Media ID to reply to"),
    text: z.string().describe("Reply text")
  }),
  th_get_user_insights: z.object({}),
  th_get_publishing_limit: z.object({})
};
var toolDescriptions = {
  th_post_thread: "Publish a new Thread (text, media, or link).",
  th_post_photo: "Publish a Photo Thread.",
  th_post_video: "Publish a Video Thread.",
  th_post_carousel: "Publish a Carousel Thread.",
  th_get_replies: "Get replies to a specific thread.",
  th_reply: "Reply to a thread or comment.",
  th_get_user_threads: "Get a list of threads published by the user.",
  th_get_user_insights: "Get insights for the Threads user account.",
  th_get_publishing_limit: "Check your current Threads publishing rate limits and quota usage."
};

// src/toolRegistry.ts
import { buildToolDefinitions, parseToolArgs } from "@meta-mcp/core";
var createToolRegistry = (manager) => {
  const handlers = {
    th_post_thread: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_post_thread, args);
      return manager.postThread(parsed.text, parsed.media_type, parsed.media_url, {
        reply_control: parsed.reply_control,
        quote_post_id: parsed.quote_post_id,
        link_attachment: parsed.link_attachment,
        alt_text: parsed.alt_text
      });
    },
    th_post_photo: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_post_photo, args);
      return manager.postThread(parsed.text, "IMAGE", parsed.url, { alt_text: parsed.alt_text });
    },
    th_post_video: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_post_video, args);
      return manager.postThread(parsed.text, "VIDEO", parsed.url, { alt_text: parsed.alt_text });
    },
    th_post_carousel: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_post_carousel, args);
      return manager.postCarousel(parsed.items, parsed.text);
    },
    th_get_replies: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_get_replies, args);
      return manager.getReplies(parsed.media_id, parsed.limit, parsed.cursor);
    },
    th_reply: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_reply, args);
      return manager.replyToThread(parsed.media_id, parsed.text);
    },
    th_get_user_threads: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_get_user_threads, args);
      return manager.getUserThreads(parsed.limit);
    },
    th_get_user_insights: async () => manager.getUserInsights(),
    th_get_publishing_limit: async () => manager.getPublishingLimit()
  };
  const definitions = buildToolDefinitions(toolSchemas, toolDescriptions);
  return { definitions, handlers };
};

// src/ai-sdk.ts
import { tool } from "ai";
var buildTool = (schema, description, execute) => tool({
  description,
  parameters: schema,
  execute: async (args) => execute(args)
});
var createAiSdkTools = (manager = ThreadsManager.fromEnv()) => ({
  th_post_thread: buildTool(
    toolSchemas.th_post_thread,
    toolDescriptions.th_post_thread,
    async (args) => manager.postThread(args.text, args.media_type, args.media_url, {
      reply_control: args.reply_control,
      quote_post_id: args.quote_post_id,
      link_attachment: args.link_attachment,
      alt_text: args.alt_text
    })
  ),
  th_get_user_threads: buildTool(
    toolSchemas.th_get_user_threads,
    toolDescriptions.th_get_user_threads,
    async (args) => manager.getUserThreads(args.limit)
  ),
  th_get_user_insights: buildTool(
    toolSchemas.th_get_user_insights,
    toolDescriptions.th_get_user_insights,
    async () => manager.getUserInsights()
  ),
  th_get_publishing_limit: buildTool(
    toolSchemas.th_get_publishing_limit,
    toolDescriptions.th_get_publishing_limit,
    async () => manager.getPublishingLimit()
  )
});
export {
  ThreadsManager,
  createAiSdkTools,
  createToolRegistry,
  toolDescriptions,
  toolSchemas
};
