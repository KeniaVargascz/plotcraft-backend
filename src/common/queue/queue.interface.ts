/**
 * Abstraction for job queuing (D — Dependency Inversion).
 * Consumers depend on this interface, not the Redis implementation.
 */
export const QUEUE_SERVICE = 'QUEUE_SERVICE';

export interface QueueService {
  /** Push a job payload to a named queue */
  enqueue<T>(queue: string, payload: T): Promise<void>;
  /** Pull up to `batchSize` jobs from a named queue (returns empty array if none) */
  dequeue<T>(queue: string, batchSize: number): Promise<T[]>;
  /** Get approximate queue length */
  length(queue: string): Promise<number>;
}
