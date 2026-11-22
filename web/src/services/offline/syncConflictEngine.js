function stableTimestamp(item) {
  return Number(item?.updatedAt || item?.createdAt || 0);
}

function summarizeRecord(entityType, rec) {
  if (entityType === 'task') {
    return {
      label: rec.title || 'Untitled Task',
      preview: `${rec.isCompleted ? 'Completed' : 'Pending'} • ${rec.priority} • ${rec.dueTime || 'No due time'}`,
    };
  }
  if (entityType === 'note') {
    return {
      label: rec.title || 'Untitled Note',
      preview: String(rec.content || '').slice(0, 120),
    };
  }
  return {
    label: rec.key || 'Memory Entry',
    preview: String(rec.content || '').slice(0, 120),
  };
}

function recordsMateriallyDiffer(entityType, a, b) {
  if (entityType === 'task') {
    return (
      a.title !== b.title ||
      a.description !== b.description ||
      a.isCompleted !== b.isCompleted ||
      a.priority !== b.priority ||
      a.dueTime !== b.dueTime
    );
  }
  if (entityType === 'note') {
    return a.title !== b.title || a.content !== b.content || Boolean(a.pinned) !== Boolean(b.pinned);
  }
  return a.key !== b.key || a.content !== b.content || a.category !== b.category;
}

/**
 * Merges local records with cloud snapshot while NEVER silently overwriting a pending dirty
 * local edit that diverges from a modified cloud version. Divergent items produce explicit
 * SyncConflictItem entries for user choice (Keep Local / Keep Cloud / Keep Both).
 */
export function mergeWithConflictDetection(params) {
  const deletedIds = params.deletedIds || new Set();
  const cloudById = new Map();
  for (const c of params.cloudItems) {
    cloudById.set(c.id, c);
  }

  const merged = [];
  const conflicts = [];
  const seen = new Set();

  for (const local of params.localItems) {
    seen.add(local.id);
    if (local.deletedAt || local.syncStatus === 'pending_delete' || deletedIds.has(local.id)) {
      continue;
    }
    const cloud = cloudById.get(local.id);
    if (!cloud) {
      merged.push({ ...local, syncStatus: 'synced' });
      continue;
    }

    const localDirty = local.syncStatus === 'pending_upsert' || local.syncStatus === 'conflict';
    const differs = recordsMateriallyDiffer(params.entityType, local, cloud);

    if (localDirty && differs) {
      const localSummary = summarizeRecord(params.entityType, local);
      const cloudSummary = summarizeRecord(params.entityType, cloud);
      conflicts.push({
        id: `${params.entityType}::${local.id}`,
        entityType: params.entityType,
        label: localSummary.label || cloudSummary.label,
        localPreview: localSummary.preview,
        cloudPreview: cloudSummary.preview,
        localUpdatedAt: stableTimestamp(local),
        cloudUpdatedAt: stableTimestamp(cloud),
        localRecord: local,
        cloudRecord: cloud,
        detectedAt: Date.now(),
      });
      merged.push({ ...local, syncStatus: 'conflict' });
    } else if (stableTimestamp(cloud) > stableTimestamp(local) && !localDirty) {
      merged.push({ ...cloud, syncStatus: 'synced' });
    } else {
      merged.push({ ...local, syncStatus: 'synced' });
    }
  }

  for (const cloud of params.cloudItems) {
    if (seen.has(cloud.id) || deletedIds.has(cloud.id)) continue;
    merged.push({ ...cloud, syncStatus: 'synced' });
  }

  return { merged, conflicts };
}

export function resolveConflictRecord(conflict, choice) {
  const now = Date.now();
  if (choice === 'keep_local') {
    return [{ ...conflict.localRecord, updatedAt: now, syncStatus: 'pending_upsert' }];
  }
  if (choice === 'keep_cloud') {
    return [{ ...conflict.cloudRecord, syncStatus: 'synced' }];
  }
  const clonedLocal = {
    ...conflict.localRecord,
    id: `${conflict.localRecord.id}_local_${now}`,
    updatedAt: now,
    syncStatus: 'pending_upsert',
  };
  return [{ ...conflict.cloudRecord, syncStatus: 'synced' }, clonedLocal];
}
