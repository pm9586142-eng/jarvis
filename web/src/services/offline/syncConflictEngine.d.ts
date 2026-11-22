import {
  MemoryItem,
  NoteItem,
  SyncConflictItem,
  SyncEntityType,
  TaskItem,
} from '../../types/jarvis';

export interface EntityMergeResult<
  T extends { id: string; updatedAt?: number; createdAt?: number; syncStatus?: string },
> {
  merged: T[];
  conflicts: SyncConflictItem[];
}

export function mergeWithConflictDetection<T extends TaskItem | NoteItem | MemoryItem>(params: {
  entityType: SyncEntityType;
  localItems: T[];
  cloudItems: T[];
  deletedIds?: Set<string>;
}): EntityMergeResult<T>;

export function resolveConflictRecord<T extends TaskItem | NoteItem | MemoryItem>(
  conflict: SyncConflictItem,
  choice: 'keep_local' | 'keep_cloud' | 'keep_both'
): T[];
