export interface BaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findMany(args?: any): Promise<T[]>;
  create(data: any): Promise<T>;
  update(id: string, data: any): Promise<T>;
  delete(id: string): Promise<T>;
  count(args?: any): Promise<number>;
}
