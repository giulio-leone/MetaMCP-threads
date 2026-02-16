import type { ThreadsManager } from "./manager.js";
import { toolDescriptions, toolSchemas, type ToolName } from "./toolSchemas.js";
import { buildToolDefinitions, parseToolArgs, type ToolDefinition, type ToolHandler, type ToolRegistry } from "@meta-mcp/core";

export type { ToolDefinition, ToolHandler, ToolRegistry };

export const createToolRegistry = (manager: ThreadsManager): ToolRegistry<ToolName> => {
  const handlers: Record<ToolName, ToolHandler> = {
    th_post_thread: async (args) => {
      const parsed = parseToolArgs(toolSchemas.th_post_thread, args);
      return manager.postThread(parsed.text, parsed.media_type, parsed.media_url, {
        reply_control: parsed.reply_control,
        quote_post_id: parsed.quote_post_id,
        link_attachment: parsed.link_attachment,
        alt_text: parsed.alt_text,
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
    th_get_publishing_limit: async () => manager.getPublishingLimit(),
  };

  const definitions = buildToolDefinitions(toolSchemas, toolDescriptions) as ToolDefinition<ToolName>[];

  return { definitions, handlers };
};

export type ThreadsToolRegistry = ToolRegistry<ToolName>;
