# Implementing a Collector

This guide demonstrates how to implement a new Collector for the peerBench SDK.

## Overview

Collectors are responsible for taking a source input and creating a structured data that later can be used by the Generators to generate new Prompts.

## Basic Example

Here's a simple collector implementation that demonstrates the basic structure:

```typescript
import { AbstractCollector } from "@/collectors/abstract/abstract-collector";

interface MyCollectedData {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
}

export class SimpleAPICollector extends AbstractCollector<MyCollectedData[]> {
  readonly identifier = "simple-api-collector";

  async collect(
    source: unknown,
    options?: Record<string, any>
  ): Promise<MyCollectedData[] | undefined> {
    // Type guard for input validation
    if (typeof source !== "string") {
      throw new Error("Source must be a string URL");
    }

    // Fetch data from external source
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse and transform the response
    const rawData = await response.json();
    return this.transformData(rawData);
  }

  private transformData(rawData: any): MyCollectedData[] {
    return rawData.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      metadata: item.metadata || {},
    }));
  }
}
```

### Required Properties

**`readonly identifier: string`**

- A unique string that identifies your Collector
- Should be descriptive and unique across all Collectors
- Useful when you try to find this Collector among the others

### Abstract Methods

**`async collect(source: unknown, options?: Record<string, any>): Promise<T | undefined>`**

- This is the main collection method you must implement
- Takes a `source` as the input
- Interpretation of what `source` parameter is depends on the implementation
- For example if it is a URL, you should validate that it is a real URL string and fetch data from it
- Or if it is a file path, you should be checking that file is exist
- Optional `options` parameter for configurable collection behavior
- Must return data matching your Collector's output type `T`, or `undefined` if the process fails
- The generic type `T` represents what your collector **outputs**

## Advanced Patterns

### RSS Feed Collector

For RSS feeds, extend `AbstractRSSCollector` instead:

```typescript
import { AbstractRSSCollector } from "@/collectors/abstract/abstract-rss-collector";
import { z } from "zod";

export class MyRSSCollector extends AbstractRSSCollector<MyRSSData[]> {
  readonly identifier = "my-rss-collector";

  // Define the expected RSS structure using Zod
  feedSchema = z.object({
    rss: z.object({
      channel: z.object({
        title: z.string(),
        item: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            link: z.string(),
            pubDate: z.string(),
          })
        ),
      }),
    }),
  });

  async collect(url: string): Promise<MyRSSData[] | undefined> {
    const feed = await this.parseFeedXML(await this.fetchFeed(url));

    // Process the validated RSS data
    return feed.rss.channel.item.map((item) => ({
      title: item.title,
      description: item.description,
      link: item.link,
      publishedAt: new Date(item.pubDate),
    }));
  }
}
```

### Collector with Authentication

For APIs requiring authentication:

```typescript
export class AuthenticatedAPICollector extends AbstractCollector<MyData[]> {
  readonly identifier = "authenticated-api";

  async collect(
    source: unknown,
    options: {
      includeSensitiveContent?: boolean;
      limit?: number;
      sortBy?: "relevance" | "date" | "popularity";
      language?: string;
    } = {}
  ): Promise<MyData[] | undefined> {
    if (typeof source !== "string") {
      throw new Error("Source must be a search query string");
    }

    // Build the API request parameters using options
    const params = new URLSearchParams();
    params.set("q", source);

    // Apply options to customize the API request
    if (options.includeSensitiveContent) {
      params.set("sensitive", "true");
    }
    if (options.limit) {
      params.set("limit", options.limit.toString());
    }
    if (options.sortBy) {
      params.set("sortBy", options.sortBy);
    }
    if (options.language) {
      params.set("language", options.language);
    }

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(
      `${this.baseUrl}/search?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return this.transformData(data, options.limit);
  }

  private transformData(rawData: any, limit?: number): MyData[] {
    let results = rawData.results?.map(this.mapToMyData) || [];

    if (limit && results.length > limit) {
      results = results.slice(0, limit);
    }

    return results;
  }
}
```

## Examples

See the `examples/collectors/` directory for complete working examples:

- `file-system-collector.ts` - Local file collection
- `news-api-collector.ts` - API-based collection

These examples demonstrate real-world implementations and can serve as templates for your own collectors.

## What's Next?

Now that you understand how to implement a Collector, you're ready to learn about the next component in the peerBench SDK: **Generators**.

**Next Documentation**: [Implementing a Generator](./implementing-a-generator.md)
