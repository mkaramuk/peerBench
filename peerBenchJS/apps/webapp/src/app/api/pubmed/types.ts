export type PubMedRawRSSArticle = {
  title: string;
  guid: string;
  "content:encoded": string;
};

export type PubMedRSSArticle = {
  pmid: string;
  title: string;
  paragraphs: Record<string, string>;
};
