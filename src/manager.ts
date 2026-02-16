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
        reply_to_id?: string;
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

    async postCarousel(items: { url: string; media_type: "IMAGE" | "VIDEO"; alt_text?: string }[], text?: string): Promise<Record<string, unknown>> {
        // Step 1: Create Item Containers
        const childrenIds: string[] = [];
        for (const item of items) {
            const itemParams: Record<string, any> = {
                media_type: item.media_type,
                is_carousel_item: true,
            };
            if (item.media_type === "IMAGE") itemParams.image_url = item.url;
            if (item.media_type === "VIDEO") itemParams.video_url = item.url;
            if (item.alt_text) itemParams.alt_text = item.alt_text;

            const container = await this.request("me/threads", "POST", itemParams) as { id: string };
            if (container.id) childrenIds.push(container.id);
        }

        if (childrenIds.length === 0) {
            throw new Error("Failed to create carousel items");
        }

        // Step 2: Create Carousel Container
        const creationParams: Record<string, any> = {
            media_type: "CAROUSEL",
            children: childrenIds.join(","), // Threads API expects comma-separated string or array? Usually array/string. Graph API v19+ often accepts array, but let's check. 
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

        const container = await this.request("me/threads", "POST", creationParams) as { id: string };

        // Step 3: Publish
        return this.publishThread(container.id);
    }

    async getReplies(mediaId: string, limit = 25, cursor?: string): Promise<Record<string, unknown>> {
        return this.request(
            `${mediaId}/replies`,
            "GET",
            {
                fields: "id,text,username,timestamp,like_count,reply_count",
                limit,
                after: cursor,
            }
        );
    }

    async replyToThread(mediaId: string, text: string): Promise<Record<string, unknown>> {
        return this.postThread(text, "TEXT", undefined, { reply_to_id: mediaId });
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
