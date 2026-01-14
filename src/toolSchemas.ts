import { z } from "zod";

export const toolSchemas = {
    th_post_thread: z.object({
        text: z.string().optional().describe("Text content of the thread. Required if media_type is TEXT."),
        media_type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
        media_url: z.string().url().optional(),
        reply_control: z.enum(["everyone", "accounts_you_follow", "mentioned_only"]).optional().describe("Who can reply to this thread"),
        quote_post_id: z.string().optional().describe("ID of a post to quote"),
        link_attachment: z.string().url().optional().describe("URL to attach"),
        alt_text: z.string().optional().describe("Alt text for media"),
    }),
    th_get_user_threads: z.object({
        limit: z.number().int().min(1).max(50).optional().default(25),
    }),
    th_get_user_insights: z.object({}),
    th_get_publishing_limit: z.object({}),
};

export const toolDescriptions = {
    th_post_thread: "Publish a new Thread.",
    th_get_user_threads: "Get a list of threads published by the user.",
    th_get_user_insights: "Get insights for the Threads user account.",
    th_get_publishing_limit: "Check your current Threads publishing rate limits and quota usage.",
};

export type ToolName = keyof typeof toolSchemas;

// Export inferred types for each tool schema
export type ThPostThreadArgs = z.infer<typeof toolSchemas.th_post_thread>;
export type ThGetUserThreadsArgs = z.infer<typeof toolSchemas.th_get_user_threads>;
export type ThGetUserInsightsArgs = z.infer<typeof toolSchemas.th_get_user_insights>;
export type ThGetPublishingLimitArgs = z.infer<typeof toolSchemas.th_get_publishing_limit>;
