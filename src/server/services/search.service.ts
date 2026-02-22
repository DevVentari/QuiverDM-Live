import { generateEmbedding } from '@/lib/ai/embeddings';
import {
  type EmbeddingEntityType,
  semanticSearch,
} from '@/server/repositories/embedding.repository';
import { authz } from './authorization.service';

export class SearchService {
  async semantic(
    query: string,
    campaignId: string,
    userId: string,
    entityTypes: EmbeddingEntityType[] = [],
    limit = 10
  ) {
    await authz.campaign(campaignId, userId).verify();
    const queryVector = await generateEmbedding(query);
    return semanticSearch(queryVector, campaignId, entityTypes, limit);
  }
}

export const searchService = new SearchService();
