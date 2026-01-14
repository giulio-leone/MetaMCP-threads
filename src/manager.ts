import { GraphApiClient, graphConfig, ThreadsMedia, ThreadsInsight } from "@meta-mcp/core";

export class ThreadsManager {
    private readonly client: GraphApiClient;
    private readonly userId: string;
    private readonly accessToken: string;
    private readonly baseUrl = "https://graph.threads.net/v1.0"; // Threads uses v1.0 currently

    constructor(client: GraphApiClient, userId: string, accessToken: string) {
        this.client = client;
        this.userId = userId;
        this.accessToken = accessToken;
    }

    static fromEnv(): ThreadsManager {
        if (!graphConfig.threadsUserId || !graphConfig.threadsAccessToken) {
            throw new Error("THREADS_USER_ID or THREADS_ACCESS_TOKEN is not configured");
        }
        return new ThreadsManager(
            new GraphApiClient(graphConfig),
            graphConfig.threadsUserId,
            graphConfig.threadsAccessToken
        );
    }

    private async request(endpoint: string, method: "GET" | "POST", params?: Record<string, any>) {
        return this.client.request({
            method,
            endpoint,
            params,
            baseUrl: this.baseUrl,
            accessToken: this.accessToken,
        });
    }

    async postThread(text?: string, mediaType: "TEXT" | "IMAGE" | "VIDEO" = "TEXT", mediaUrl?: string, options: {
        reply_control?: "everyone" | "accounts_you_follow" | "mentioned_only";
        quote_post_id?: string;
        link_attachment?: string;
        alt_text?: string;
    } = {}): Promise<Record<string, unknown>> {
        if (mediaType === "TEXT" && !text) {
            throw new Error("Text is required for TEXT media type");
        }

        const creationParams: Record<string, any> = {
            media_type: mediaType,
            text: text,
            ...options
        };
        if (mediaUrl) {
            creationParams[mediaType === "IMAGE" ? "image_url" : "video_url"] = mediaUrl;
        }

        // Step 1: Create Container
        const container = await this.request(
            "me/threads",
            "POST",
            creationParams
        ) as { id: string };

        if (!container.id) {
            throw new Error("Failed to create threads container");
        }

        // Step 2: Publish Container
        return this.publishThread(container.id);
    }

    async publishThread(creationId: string): Promise<Record<string, unknown>> {
        return this.request(
            `${this.userId}/threads_publish`,
            "POST",
            { creation_id: creationId }
        );
    }

    async getUserThreads(limit = 25): Promise<ThreadsMedia[]> {
        const response = await this.request(
            `${this.userId}/threads`,
            "GET",
            {
                fields: "id,text,media_type,media_url,permalink,timestamp,like_count,reply_count",
                limit,
            }
        ) as { data: ThreadsMedia[] };
        return response.data;
    }

    async getUserInsights(): Promise<ThreadsInsight[]> {
        const response = await this.request(
            `${this.userId}/threads_insights`,
            "GET",
            {
                metric: "views,likes,replies,reposts,quotes", // Example metrics
                period: "day",
            }
        ) as { data: ThreadsInsight[] };
        return response.data;
    }

    async getPublishingLimit(): Promise<Record<string, unknown>> {
        const response = await this.request(
            `${this.userId}/threads_publishing_limit`,
            "GET",
            {
                fields: "quota_usage,config,reply_quota_usage,reply_config",
            },
        );
        return response.data as Record<string, unknown>;
    }
}
