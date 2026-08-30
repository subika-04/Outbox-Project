import axios from 'axios';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

const ES_URL = env.ELASTICSEARCH_URL.replace(/\/$/, ''); // Remove trailing slash if any
const INDEX_NAME = 'emails';

export class ElasticsearchService {
  /**
   * Initializes the Elasticsearch index with appropriate mapping properties.
   * Runs on application startup.
   */
  static async initIndex() {
    try {
      console.log(`[Elasticsearch] Checking if index '${INDEX_NAME}' exists...`);
      const existsResponse = await axios.get(`${ES_URL}/${INDEX_NAME}`, {
        validateStatus: (status) => status === 200 || status === 404,
      });

      if (existsResponse.status === 404) {
        console.log(`[Elasticsearch] Index '${INDEX_NAME}' does not exist. Creating with mappings...`);
        
        await axios.put(`${ES_URL}/${INDEX_NAME}`, {
          mappings: {
            properties: {
              emailId: { type: 'keyword' },
              userId: { type: 'keyword' },
              sender: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
            },
          },
        });
        
        console.log(`[Elasticsearch] Index '${INDEX_NAME}' created successfully.`);
      } else {
        console.log(`[Elasticsearch] Index '${INDEX_NAME}' already exists.`);
      }
    } catch (err: any) {
      console.error(`[Elasticsearch] Initialization failed: ${err.message}. App will fall back gracefully.`);
    }
  }

  /**
   * Indexes a single email document.
   * Fails silently (logs only) to avoid interrupting database transactions or workers.
   */
  static async indexEmail(emailId: string): Promise<boolean> {
    try {
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: { sender: true },
      });

      if (!email) {
        console.warn(`[Elasticsearch] Email ${emailId} not found. Skipping index.`);
        return false;
      }

      console.log(`[Elasticsearch] Indexing email ${emailId}...`);

      const payload = {
        emailId: email.id,
        userId: email.userId,
        sender: email.sender.email,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
      };

      await axios.put(`${ES_URL}/${INDEX_NAME}/_doc/${email.id}`, payload);

      // Update the indexed timestamp in the database
      await prisma.email.update({
        where: { id: emailId },
        data: { esIndexedAt: new Date() },
      });

      console.log(`[Elasticsearch] Successfully indexed email ${emailId}`);
      return true;
    } catch (err: any) {
      console.error(`[Elasticsearch] Failed to index email ${emailId}:`, err.message);
      return false;
    }
  }

  /**
   * Performs a search on the email index, scoped by userId.
   * Gracefully returns empty results with a down flag if Elasticsearch is unavailable.
   */
  static async search(
    userId: string,
    queryText: string
  ): Promise<{ results: any[]; isElasticsearchDown: boolean }> {
    try {
      // If the query is empty, Elasticsearch can return everything or we handle it in controller
      const mustQueries: any[] = [{ term: { userId } }];

      if (queryText.trim()) {
        mustQueries.push({
          multi_match: {
            query: queryText,
            fields: ['subject', 'body', 'recipient', 'sender'],
            fuzziness: 'AUTO',
          },
        });
      }

      const response = await axios.post(`${ES_URL}/${INDEX_NAME}/_search`, {
        query: {
          bool: {
            must: mustQueries,
          },
        },
        size: 50, // Limit search to top 50 matches
      });

      const hits = response.data?.hits?.hits || [];
      const results = hits.map((hit: any) => ({
        id: hit._source.emailId,
        recipient: hit._source.recipient,
        subject: hit._source.subject,
        body: hit._source.body,
        status: hit._source.status,
        scheduledAt: hit._source.scheduledAt,
        sentAt: hit._source.sentAt,
      }));

      return {
        results,
        isElasticsearchDown: false,
      };
    } catch (err: any) {
      console.error(`[Elasticsearch] Search query failed: ${err.message}`);
      return {
        results: [],
        isElasticsearchDown: true,
      };
    }
  }
}
