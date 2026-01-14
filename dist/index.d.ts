import { GraphApiClient, ThreadsMedia, ThreadsInsight } from '@meta-mcp/core';
import { z } from 'zod';
import * as ai from 'ai';

declare class ThreadsManager {
    private readonly client;
    private readonly userId;
    private readonly accessToken;
    private readonly baseUrl;
    constructor(client: GraphApiClient, userId: string, accessToken: string);
    static fromEnv(): ThreadsManager;
    private request;
    postThread(text?: string, mediaType?: "TEXT" | "IMAGE" | "VIDEO", mediaUrl?: string, options?: {
        reply_control?: "everyone" | "accounts_you_follow" | "mentioned_only";
        quote_post_id?: string;
        link_attachment?: string;
        alt_text?: string;
    }): Promise<Record<string, unknown>>;
    publishThread(creationId: string): Promise<Record<string, unknown>>;
    getUserThreads(limit?: number): Promise<ThreadsMedia[]>;
    getUserInsights(): Promise<ThreadsInsight[]>;
    getPublishingLimit(): Promise<Record<string, unknown>>;
}

declare const toolSchemas: {
    th_post_thread: z.ZodObject<{
        text: z.ZodOptional<z.ZodString>;
        media_type: z.ZodDefault<z.ZodEnum<["TEXT", "IMAGE", "VIDEO"]>>;
        media_url: z.ZodOptional<z.ZodString>;
        reply_control: z.ZodOptional<z.ZodEnum<["everyone", "accounts_you_follow", "mentioned_only"]>>;
        quote_post_id: z.ZodOptional<z.ZodString>;
        link_attachment: z.ZodOptional<z.ZodString>;
        alt_text: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        media_type: "TEXT" | "IMAGE" | "VIDEO";
        text?: string | undefined;
        media_url?: string | undefined;
        reply_control?: "everyone" | "accounts_you_follow" | "mentioned_only" | undefined;
        quote_post_id?: string | undefined;
        link_attachment?: string | undefined;
        alt_text?: string | undefined;
    }, {
        media_type?: "TEXT" | "IMAGE" | "VIDEO" | undefined;
        text?: string | undefined;
        media_url?: string | undefined;
        reply_control?: "everyone" | "accounts_you_follow" | "mentioned_only" | undefined;
        quote_post_id?: string | undefined;
        link_attachment?: string | undefined;
        alt_text?: string | undefined;
    }>;
    th_get_user_threads: z.ZodObject<{
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
    }, {
        limit?: number | undefined;
    }>;
    th_get_user_insights: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    th_get_publishing_limit: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
};
declare const toolDescriptions: {
    th_post_thread: string;
    th_get_user_threads: string;
    th_get_user_insights: string;
    th_get_publishing_limit: string;
};
type ToolName = keyof typeof toolSchemas;
type ThPostThreadArgs = z.infer<typeof toolSchemas.th_post_thread>;
type ThGetUserThreadsArgs = z.infer<typeof toolSchemas.th_get_user_threads>;
type ThGetUserInsightsArgs = z.infer<typeof toolSchemas.th_get_user_insights>;
type ThGetPublishingLimitArgs = z.infer<typeof toolSchemas.th_get_publishing_limit>;

interface ToolDefinition {
    name: ToolName;
    description: string;
    inputSchema: Record<string, unknown>;
}
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;
interface ToolRegistry {
    definitions: ToolDefinition[];
    handlers: Record<ToolName, ToolHandler>;
}
declare const createToolRegistry: (manager: ThreadsManager) => ToolRegistry;

declare const createAiSdkTools: (manager?: ThreadsManager) => {
    th_post_thread: ai.Tool<any, unknown> & {
        execute: (args: any, options: ai.ToolExecutionOptions) => PromiseLike<unknown>;
    };
    th_get_user_threads: ai.Tool<any, unknown> & {
        execute: (args: any, options: ai.ToolExecutionOptions) => PromiseLike<unknown>;
    };
    th_get_user_insights: ai.Tool<any, unknown> & {
        execute: (args: any, options: ai.ToolExecutionOptions) => PromiseLike<unknown>;
    };
    th_get_publishing_limit: ai.Tool<any, unknown> & {
        execute: (args: any, options: ai.ToolExecutionOptions) => PromiseLike<unknown>;
    };
};

export { type ThGetPublishingLimitArgs, type ThGetUserInsightsArgs, type ThGetUserThreadsArgs, type ThPostThreadArgs, ThreadsManager, type ToolDefinition, type ToolHandler, type ToolName, type ToolRegistry, createAiSdkTools, createToolRegistry, toolDescriptions, toolSchemas };
