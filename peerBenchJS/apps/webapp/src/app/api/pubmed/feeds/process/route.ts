import { db } from "@/database/client";
import { PromptSetService } from "@/services/promptset.service";
import { RSSArticleService } from "@/services/rss-article.service";
import {
  calculateCID,
  calculateSHA256,
  OpenRouterProvider,
  Prompt,
  PromptTypes,
} from "@peerbench/sdk";
import { SROTaskGenerator } from "../../generators/sro";
import {
  ParagraphMergeStrategy,
  ParagraphMergeStrategyType,
} from "../../generators/common/steps/merge-paragraphs";
import { PubMedRawRSSArticle, PubMedRSSArticle } from "../../types";
import { parseRawRSSArticle } from "../../functions/rss";
import { v7 as uuidv7 } from "uuid";
import { NextRequest, NextResponse } from "next/server";
import { TRPTaskGenerator } from "../../generators/trp";
import { ReplaceEntityStrategy } from "../../generators/trp/steps/replace-entities";
import { NEREntityType } from "../../generators/trp/steps/perform-ner";
import { cryptoRandom } from "@/utils/crypto-random";
import { DbPromptSet, DbRSSArticle } from "@/database/schema";
import { TYPTaskGenerator } from "../../generators/typ";
import {
  MakeTypoStrategies,
  MakeTypoStrategy,
  PickTextStrategies,
  PickTextStrategy,
} from "../../generators/typ/steps/make-typo";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  // Dummy user that uploads the prompts
  const peerBenchAdminId = "c9439eab-d850-46bd-8ae1-211216395732";
  const articles = await RSSArticleService.getUnprocessedArticles();

  if (articles.length === 0) {
    return NextResponse.json({
      newPromptsCount: 0,
    });
  }

  // Ensure that the prompt set exists
  const promptSet = await PromptSetService.createNewPromptSet({
    title: "PubMed",
    description:
      "PubMed® comprises more than 38 million citations for biomedical literature from MEDLINE, life science journals, and online books. Citations may include links to full text content from PubMed Central and publisher web sites. ",

    ownerId: peerBenchAdminId,
  });

  // Generate different tasks/prompts/samples (whatever we call)
  // from the articles in parallel.
  const newPromptsCount = (
    await Promise.all(
      articles.map((article) =>
        generatePromptFromArticle(article, promptSet, peerBenchAdminId)
      )
    )
  ).reduce((acc, count) => acc + count, 0);

  return NextResponse.json({
    newPromptsCount,
  });
}

async function generatePromptFromArticle(
  dbArticle: DbRSSArticle,
  promptSet: DbPromptSet,
  peerBenchAdminId: string
) {
  const article = parseRawRSSArticle(dbArticle.content as PubMedRawRSSArticle);

  try {
    console.log("Processing article", dbArticle.id);

    const sroPromptVariations = await generateSRO(article, dbArticle.tags);
    console.log("SRO prompts generated");

    const trpPromptVariations = await generateTRP(article, dbArticle.tags);
    console.log("TRP prompts generated");

    const typPromptVariations = await generateTYP(article, dbArticle.tags);
    console.log("TYP prompts generated");

    console.log(`Article ${dbArticle.id} has been processed`);

    return await db.transaction(async (tx) => {
      // Mark the articles as processed because we have already generated
      // prompts from them so no need to reprocess again.
      await RSSArticleService.markAsProcessed([dbArticle.id], { tx });

      // Save those new prompts
      return await PromptSetService.addPromptsToPromptSet(
        {
          promptSetId: promptSet.id,
          uploaderId: peerBenchAdminId,
          fileContent: JSON.stringify([
            ...sroPromptVariations,
            ...trpPromptVariations,
            ...typPromptVariations,
          ]),
        },
        { tx }
      );
    });
  } catch (error) {
    console.error(error);
  }

  return 0;
}

async function generateTYP(
  article: PubMedRSSArticle,
  articleTags: string[]
): Promise<Prompt[]> {
  const generate = async (
    pickTextStrategy: PickTextStrategy,
    difficulty: MakeTypoStrategy
  ): Promise<Prompt> => {
    const generator = new TYPTaskGenerator({
      strategy: pickTextStrategy,
      difficulty,
    });

    const [originalText, modifiedText] = (await generator.run(article))![0]!;

    const questionData = modifiedText!;
    const questionCID = (await calculateCID(questionData)).toString();
    const questionSHA256 = await calculateSHA256(questionData);

    return {
      answer: originalText,
      question: {
        cid: questionCID,
        data: questionData,
        sha256: questionSHA256,
      },
      fullPrompt: {
        cid: questionCID,
        data: questionData,
        sha256: questionSHA256,
      },
      type: PromptTypes.Typo,
      metadata: {
        articleTags,
        articleId: article.pmid,
        pickTextStrategy,
        difficulty,
        generatorTags: generator.tags(),
      },
      did: uuidv7(),
      answerKey: "",
      options: {},
    };
  };

  const promises: Promise<any>[] = [];
  for (const pickTextStrategy of Object.values(PickTextStrategies)) {
    for (const difficulty of Object.values(MakeTypoStrategies)) {
      promises.push(generate(pickTextStrategy, difficulty));
    }
  }

  return await Promise.all(promises);
}

async function generateTRP(
  article: PubMedRSSArticle,
  articleTags: string[]
): Promise<Prompt[]> {
  const brainModel = "google/gemini-2.0-flash-001";
  const provider = new OpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY!,

    // Max 5 requests per 2 seconds
    rateLimit: 5,
    rateLimitTimeWindow: 2_000,
  });
  const entityTypes: NEREntityType[] = [
    "nouns",
    "verbs",
    "adjectives",
    "named-entities",
    "medical-related-entities",
  ];

  const generate = async (
    paragraphMergeStrategy: ParagraphMergeStrategyType,
    entityTypes: NEREntityType[]
  ) => {
    const trpGenerator = new TRPTaskGenerator({
      provider,
      model: brainModel,
      entityTypes,
      replaceEntityStrategy: ReplaceEntityStrategy.WithPlaceholder,
      paragraphMergeStrategy,
    });
    const [originalText, entities, modifiedText] =
      await trpGenerator.run(article);

    const fullPrompt = `TEXT:\n${modifiedText!}\n\nENTITIES:\n${entities!
      .sort(() => cryptoRandom() - 0.5)
      .map((e) => `"${e}"`)
      .join(", ")}`;

    return {
      answer: originalText!,

      question: {
        cid: (await calculateCID(modifiedText!)).toString(),
        data: modifiedText!,
        sha256: await calculateSHA256(modifiedText!),
      },
      fullPrompt: {
        data: fullPrompt,
        cid: (await calculateCID(fullPrompt)).toString(),
        sha256: await calculateSHA256(fullPrompt),
      },
      type: PromptTypes.TextReplacement,
      metadata: {
        articleTags,
        articleId: article.pmid,
        paragraphMergeStrategy,
        replaceEntityStrategy: ReplaceEntityStrategy.WithPlaceholder,
        entityTypes,
        entities,
        brainModel,
        generatorTags: trpGenerator.tags(),
      },
      did: uuidv7(),
      answerKey: "",
      options: {},
    };
  };

  const promises: Promise<any>[] = [];
  for (const paragraphMergeStrategy of Object.values(ParagraphMergeStrategy)) {
    for (const entityType of entityTypes) {
      promises.push(generate(paragraphMergeStrategy, [entityType]));
    }
  }

  return await Promise.all(promises);
}

async function generateSRO(
  article: PubMedRSSArticle,
  articleTags: string[]
): Promise<Prompt[]> {
  const generate = async (
    paragraphMergeStrategy: ParagraphMergeStrategyType
  ) => {
    const sroGenerator = new SROTaskGenerator(paragraphMergeStrategy);
    const [, originalOrder, shuffledOrder] = await sroGenerator.run(article);

    const questionData = shuffledOrder!.join("\n");
    const questionCID = (await calculateCID(questionData)).toString();
    const questionSHA256 = await calculateSHA256(questionData);

    return {
      answer: originalOrder!.join("\n"),

      // TODO: Until we redesign the data structures, `fullPrompt` is the same as `question`
      question: {
        cid: questionCID,
        data: questionData,
        sha256: questionSHA256,
      },
      fullPrompt: {
        data: questionData,
        cid: questionCID,
        sha256: questionSHA256,
      },
      type: PromptTypes.OrderSentences,
      metadata: {
        articleTags,
        articleId: article.pmid,
        paragraphMergeStrategy,
        generatorTags: sroGenerator.tags(),
      },
      did: uuidv7(),
      answerKey: "",
      options: {},
    };
  };

  const promises: Promise<any>[] = [];
  for (const paragraphMergeStrategy of Object.values(ParagraphMergeStrategy)) {
    promises.push(generate(paragraphMergeStrategy));
  }

  return await Promise.all(promises);
}
