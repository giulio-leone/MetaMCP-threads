"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ThreadsManager: () => ThreadsManager,
  createAiSdkTools: () => createAiSdkTools,
  createToolRegistry: () => createToolRegistry,
  toolDescriptions: () => toolDescriptions,
  toolSchemas: () => toolSchemas
});
module.exports = __toCommonJS(index_exports);

// src/manager.ts
var import_core = require("@meta-mcp/core");
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
    if (!import_core.graphConfig.threadsUserId || !import_core.graphConfig.threadsAccessToken) {
      throw new Error("THREADS_USER_ID or THREADS_ACCESS_TOKEN is not configured");
    }
    return new _ThreadsManager(
      new import_core.GraphApiClient(import_core.graphConfig),
      import_core.graphConfig.threadsUserId,
      import_core.graphConfig.threadsAccessToken
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
var import_zod = require("zod");
var toolSchemas = {
  th_post_thread: import_zod.z.object({
    text: import_zod.z.string().optional().describe("Text content of the thread. Required if media_type is TEXT."),
    media_type: import_zod.z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
    media_url: import_zod.z.string().url().optional(),
    reply_control: import_zod.z.enum(["everyone", "accounts_you_follow", "mentioned_only"]).optional().describe("Who can reply to this thread"),
    quote_post_id: import_zod.z.string().optional().describe("ID of a post to quote"),
    link_attachment: import_zod.z.string().url().optional().describe("URL to attach"),
    alt_text: import_zod.z.string().optional().describe("Alt text for media")
  }),
  th_get_user_threads: import_zod.z.object({
    limit: import_zod.z.number().int().min(1).max(50).optional().default(25)
  }),
  th_get_user_insights: import_zod.z.object({}),
  th_get_publishing_limit: import_zod.z.object({})
};
var toolDescriptions = {
  th_post_thread: "Publish a new Thread.",
  th_get_user_threads: "Get a list of threads published by the user.",
  th_get_user_insights: "Get insights for the Threads user account.",
  th_get_publishing_limit: "Check your current Threads publishing rate limits and quota usage."
};

// src/toolRegistry.ts
var import_zod_to_json_schema = require("zod-to-json-schema");
var createToolRegistry = (manager) => {
  const handlers = {
    th_post_thread: async (args) => {
      const parsed = toolSchemas.th_post_thread.parse(args);
      return manager.postThread(parsed.text, parsed.media_type, parsed.media_url, {
        reply_control: parsed.reply_control,
        quote_post_id: parsed.quote_post_id,
        link_attachment: parsed.link_attachment,
        alt_text: parsed.alt_text
      });
    },
    th_get_user_threads: async (args) => {
      const parsed = toolSchemas.th_get_user_threads.parse(args);
      return manager.getUserThreads(parsed.limit);
    },
    th_get_user_insights: async () => {
      return manager.getUserInsights();
    },
    th_get_publishing_limit: async () => {
      return manager.getPublishingLimit();
    }
  };
  const definitions = Object.keys(toolSchemas).map((name) => ({
    name,
    description: toolDescriptions[name],
    inputSchema: (0, import_zod_to_json_schema.zodToJsonSchema)(
      toolSchemas[name],
      {
        name,
        $refStrategy: "none"
      }
    )
  }));
  return { definitions, handlers };
};

// src/ai-sdk.ts
var import_ai = require("ai");
var buildTool = (schema, description, execute) => (0, import_ai.tool)({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ThreadsManager,
  createAiSdkTools,
  createToolRegistry,
  toolDescriptions,
  toolSchemas
});
