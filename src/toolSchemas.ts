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
    th_post_photo: z.object({
        url: z.string().url().describe("Image URL"),
        text: z.string().optional().describe("Caption text"),
        alt_text: z.string().optional().describe("Alt text for the image"),
    }),
    th_post_video: z.object({
        url: z.string().url().describe("Video URL"),
        text: z.string().optional().describe("Caption text"),
        alt_text: z.string().optional().describe("Alt text for the video"),
    }),
    th_post_carousel: z.object({
        items: z.array(z.object({
            url: z.string().url(),
            media_type: z.enum(["IMAGE", "VIDEO"]),
            alt_text: z.string().optional(),
        })).min(2).max(10).describe("List of media items (images/videos)"),
        text: z.string().optional().describe("Caption for the carousel"),
    }),
    th_get_replies: z.object({
        media_id: z.string().describe("Thread/Media ID to get replies for"),
        limit: z.number().int().optional().default(25),
        cursor: z.string().optional(),
    }),
    th_reply: z.object({
        media_id: z.string().describe("Thread/Media ID to reply to"),
        text: z.string().describe("Reply text"),
    }),
    th_get_user_insights: z.object({}),
    th_get_publishing_limit: z.object({}),
};

export const toolDescriptions = {
    th_post_thread: "Publish a new Thread (text, media, or link).",
    th_post_photo: "Publish a Photo Thread.",
    th_post_video: "Publish a Video Thread.",
    th_post_carousel: "Publish a Carousel Thread.",
    th_get_replies: "Get replies to a specific thread.",
    th_reply: "Reply to a thread or comment.",
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
