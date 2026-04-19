import { Group } from '../entities/group.entity';

export abstract class GroupRepository {
  abstract findById(id: string): Promise<Group | null>;
  abstract findByCode(code: string): Promise<Group | null>;
  abstract create(group: Group): Promise<Group>;
  abstract update(group: Group): Promise<Group>;
  abstract list(limit: number, offset: number): Promise<Group[]>;
}

export const GROUP_REPOSITORY = Symbol('GROUP_REPOSITORY');
