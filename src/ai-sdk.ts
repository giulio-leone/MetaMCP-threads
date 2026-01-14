import { tool } from "ai";
import { ThreadsManager } from "./manager.js";
import { toolDescriptions, toolSchemas } from "./toolSchemas.js";

const buildTool = <TInput>(
    schema: any,
    description: string,
    execute: (args: TInput) => Promise<unknown>,
) =>
    tool({
        description,
        parameters: schema,
        execute: async (args: any) => execute(args),
    });

export const createAiSdkTools = (manager = ThreadsManager.fromEnv()) => ({
    th_post_thread: buildTool(
        toolSchemas.th_post_thread,
        toolDescriptions.th_post_thread,
        async (args: any) => manager.postThread(args.text, args.media_type, args.media_url, {
            reply_control: args.reply_control,
            quote_post_id: args.quote_post_id,
            link_attachment: args.link_attachment,
            alt_text: args.alt_text,
        }),
    ),
    th_get_user_threads: buildTool(
        toolSchemas.th_get_user_threads,
        toolDescriptions.th_get_user_threads,
        async (args: any) => manager.getUserThreads(args.limit),
    ),
    th_get_user_insights: buildTool(
        toolSchemas.th_get_user_insights,
        toolDescriptions.th_get_user_insights,
        async () => manager.getUserInsights(),
    ),
    th_get_publishing_limit: buildTool(
        toolSchemas.th_get_publishing_limit,
        toolDescriptions.th_get_publishing_limit,
        async () => manager.getPublishingLimit(),
    ),
});
