import { z } from "zod";
import {
  buildRegistry,
  MetaGraphClient,
  type ToolRegistry,
  type ThreadsMedia,
  type ThreadsInsight,
} from "@giulio-leone/meta-mcp-core";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const postThreadSchema = z.object({
  text: z.string().optional().describe("Text content. Required if media_type is TEXT."),
  media_type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
  media_url: z.string().url().optional(),
  reply_control: z.enum(["everyone", "accounts_you_follow", "mentioned_only"]).optional(),
  quote_post_id: z.string().optional(),
  link_attachment: z.string().url().optional(),
  alt_text: z.string().optional(),
});

const postPhotoSchema = z.object({
  url: z.string().url().describe("Image URL"),
  text: z.string().optional(),
  alt_text: z.string().optional(),
});

const postVideoSchema = z.object({
  url: z.string().url().describe("Video URL"),
  text: z.string().optional(),
  alt_text: z.string().optional(),
});

const postCarouselSchema = z.object({
  items: z
    .array(
      z.object({
        url: z.string().url(),
        media_type: z.enum(["IMAGE", "VIDEO"]),
        alt_text: z.string().optional(),
      }),
    )
    .min(2)
    .max(10),
  text: z.string().optional(),
});

const getRepliesSchema = z.object({
  media_id: z.string().describe("Thread / Media ID"),
  limit: z.number().int().optional().default(25),
  cursor: z.string().optional(),
});

const replySchema = z.object({
  media_id: z.string().describe("Thread / Media ID to reply to"),
  text: z.string().describe("Reply text"),
});

const getUserThreadsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(25),
});

const envSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class ThreadsManager {
  private readonly graph: MetaGraphClient;
  private readonly userId: string;

  constructor(params: { accessToken: string; userId: string }) {
    const parsed = envSchema.parse(params);
    this.graph = new MetaGraphClient({
      accessToken: parsed.accessToken,
      apiVersion: "v1.0",
      baseUrl: "https://graph.threads.net",
    });
    this.userId = parsed.userId;
  }

  static fromEnv(): ThreadsManager {
    const accessToken = process.env.THREADS_ACCESS_TOKEN;
    const userId = process.env.THREADS_USER_ID;

    if (!accessToken || !userId) {
      throw new Error("THREADS_ACCESS_TOKEN and THREADS_USER_ID are required.");
    }

    return new ThreadsManager({ accessToken, userId });
  }

  // --- Publishing ---

  async postThread(
    text?: string,
    mediaType: "TEXT" | "IMAGE" | "VIDEO" = "TEXT",
    mediaUrl?: string,
    options: {
      reply_control?: "everyone" | "accounts_you_follow" | "mentioned_only";
      quote_post_id?: string;
      reply_to_id?: string;
      link_attachment?: string;
      alt_text?: string;
    } = {},
  ) {
    if (mediaType === "TEXT" && !text) {
      throw new Error("Text is required for TEXT media type.");
    }

    const params: Record<string, unknown> = {
      media_type: mediaType,
      text,
      ...options,
    };

    if (mediaUrl) {
      params[mediaType === "IMAGE" ? "image_url" : "video_url"] = mediaUrl;
    }

    const container = await this.graph.post(`/${this.userId}/threads`, params);
    const creationId = container.id;
    if (typeof creationId !== "string") {
      throw new Error("Failed to create Threads media container.");
    }

    return this.publishThread(creationId);
  }

  async postCarousel(
    items: Array<{ url: string; media_type: "IMAGE" | "VIDEO"; alt_text?: string }>,
    text?: string,
  ) {
    const childrenIds: string[] = [];

    for (const item of items) {
      const itemParams: Record<string, unknown> = {
        media_type: item.media_type,
        is_carousel_item: true,
      };
      if (item.media_type === "IMAGE") itemParams.image_url = item.url;
      if (item.media_type === "VIDEO") itemParams.video_url = item.url;
      if (item.alt_text) itemParams.alt_text = item.alt_text;

      const container = await this.graph.post(`/${this.userId}/threads`, itemParams);
      if (typeof container.id === "string") childrenIds.push(container.id);
    }

    if (childrenIds.length === 0) {
      throw new Error("Failed to create carousel item containers.");
    }

    const carouselParams: Record<string, unknown> = {
      media_type: "CAROUSEL",
      children: childrenIds.join(","),
    };
    if (text) carouselParams.text = text;

    const container = await this.graph.post(`/${this.userId}/threads`, carouselParams);
    const creationId = container.id;
    if (typeof creationId !== "string") {
      throw new Error("Failed to create carousel container.");
    }

    return this.publishThread(creationId);
  }

  private async publishThread(creationId: string) {
    return this.graph.post(`/${this.userId}/threads_publish`, {
      creation_id: creationId,
    });
  }

  // --- Reading ---

  async getReplies(mediaId: string, limit = 25, cursor?: string) {
    return this.graph.get(`/${mediaId}/replies`, {
      fields: "id,text,username,timestamp,like_count,reply_count",
      limit,
      after: cursor,
    });
  }

  async replyToThread(mediaId: string, text: string) {
    return this.postThread(text, "TEXT", undefined, { reply_to_id: mediaId });
  }

  async getUserThreads(limit = 25): Promise<ThreadsMedia[]> {
    const response = await this.graph.get(`/${this.userId}/threads`, {
      fields: "id,text,media_type,media_url,permalink,timestamp,like_count,reply_count",
      limit,
    });
    return (response.data ?? []) as ThreadsMedia[];
  }

  // --- Insights ---

  async getUserInsights(): Promise<ThreadsInsight[]> {
    const response = await this.graph.get(`/${this.userId}/threads_insights`, {
      metric: "views,likes,replies,reposts,quotes",
      period: "day",
    });
    return (response.data ?? []) as ThreadsInsight[];
  }

  async getPublishingLimit() {
    const response = await this.graph.get(
      `/${this.userId}/threads_publishing_limit`,
      { fields: "quota_usage,config,reply_quota_usage,reply_config" },
    );
    return response.data as Record<string, unknown>;
  }
}

// ---------------------------------------------------------------------------
// Tool Registry (9 tools)
// ---------------------------------------------------------------------------

export function createToolRegistry(manager: ThreadsManager): ToolRegistry {
  return buildRegistry(
    [
      {
        name: "threads_post",
        description: "Publish a new Thread (text, image, or video)",
        inputSchema: postThreadSchema.shape,
      },
      {
        name: "threads_post_photo",
        description: "Publish a Photo Thread",
        inputSchema: postPhotoSchema.shape,
      },
      {
        name: "threads_post_video",
        description: "Publish a Video Thread",
        inputSchema: postVideoSchema.shape,
      },
      {
        name: "threads_post_carousel",
        description: "Publish a Carousel Thread (2-10 media items)",
        inputSchema: postCarouselSchema.shape,
      },
      {
        name: "threads_get_replies",
        description: "Get replies to a specific thread",
        inputSchema: getRepliesSchema.shape,
      },
      {
        name: "threads_reply",
        description: "Reply to a thread or comment",
        inputSchema: replySchema.shape,
      },
      {
        name: "threads_get_user_threads",
        description: "Get threads published by the authenticated user",
        inputSchema: getUserThreadsSchema.shape,
      },
      {
        name: "threads_get_insights",
        description: "Get insights for the Threads user account",
        inputSchema: {},
      },
      {
        name: "threads_get_publishing_limit",
        description: "Check Threads publishing rate limits and quota usage",
        inputSchema: {},
      },
    ],
    {
      threads_post: async (args: Record<string, unknown>) => {
        const p = postThreadSchema.parse(args);
        return manager.postThread(p.text, p.media_type, p.media_url, {
          reply_control: p.reply_control,
          quote_post_id: p.quote_post_id,
          link_attachment: p.link_attachment,
          alt_text: p.alt_text,
        });
      },
      threads_post_photo: async (args: Record<string, unknown>) => {
        const p = postPhotoSchema.parse(args);
        return manager.postThread(p.text, "IMAGE", p.url, { alt_text: p.alt_text });
      },
      threads_post_video: async (args: Record<string, unknown>) => {
        const p = postVideoSchema.parse(args);
        return manager.postThread(p.text, "VIDEO", p.url, { alt_text: p.alt_text });
      },
      threads_post_carousel: async (args: Record<string, unknown>) => {
        const p = postCarouselSchema.parse(args);
        return manager.postCarousel(p.items, p.text);
      },
      threads_get_replies: async (args: Record<string, unknown>) => {
        const p = getRepliesSchema.parse(args);
        return manager.getReplies(p.media_id, p.limit, p.cursor);
      },
      threads_reply: async (args: Record<string, unknown>) => {
        const p = replySchema.parse(args);
        return manager.replyToThread(p.media_id, p.text);
      },
      threads_get_user_threads: async (args: Record<string, unknown>) => {
        const p = getUserThreadsSchema.parse(args);
        return manager.getUserThreads(p.limit);
      },
      threads_get_insights: async () => manager.getUserInsights(),
      threads_get_publishing_limit: async () => manager.getPublishingLimit(),
    },
  );
}
