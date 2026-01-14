import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import type { ThreadsManager } from "./manager.js";
import { toolDescriptions, toolSchemas, type ToolName } from "./toolSchemas.js";

export interface ToolDefinition {
    name: ToolName;
    description: string;
    inputSchema: Record<string, unknown>;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

export interface ToolRegistry {
    definitions: ToolDefinition[];
    handlers: Record<ToolName, ToolHandler>;
}

export const createToolRegistry = (manager: ThreadsManager): ToolRegistry => {
    const handlers: Record<ToolName, ToolHandler> = {
        th_post_thread: async (args) => {
            const parsed = toolSchemas.th_post_thread.parse(args);
            return manager.postThread(parsed.text, parsed.media_type, parsed.media_url, {
                reply_control: parsed.reply_control,
                quote_post_id: parsed.quote_post_id,
                link_attachment: parsed.link_attachment,
                alt_text: parsed.alt_text,
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
        },
    };

    const definitions = (Object.keys(toolSchemas) as ToolName[]).map((name) => ({
        name,
        description: toolDescriptions[name],
        inputSchema: zodToJsonSchema(
            toolSchemas[name] as unknown as Parameters<typeof zodToJsonSchema>[0],
            {
                name,
                $refStrategy: "none",
            },
        ) as Record<string, unknown>,
    }));

    return { definitions, handlers };
};
