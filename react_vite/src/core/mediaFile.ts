/**
 * mediaFile.ts
 * Model for Supabase `media_library` rows and locally-imported pending files.
 * Mirrors flutter_app/lib/core/media_file.dart.
 */

export type MediaCategory =
  | 'background_landscape'
  | 'background_portrait'
  | 'background'
  | 'slide_landscape'
  | 'slide_portrait'
  | 'slide_general';

export interface MediaFile {
  id: string;
  tenantId: string;
  filename: string;
  url: string; // https URL on PHP server, or blob/local path if pending
  fileSizeBytes: number | null;
  mimeType: string;
  category: string;
  isActiveBackground: boolean;
  displayOrder: number;
  isDeleted: boolean;
  uploadedAt: Date;
  uploadedByDevice: string | null;
  metadata: Record<string, unknown>;
  isPendingUpload: boolean;
  localFilePath: string | null; // cached blob URL when available
}

export const mediaFileFromJson = (j: Record<string, any>): MediaFile => ({
  id: j.id,
  tenantId: j.tenant_id,
  filename: j.filename,
  url: j.url,
  fileSizeBytes: typeof j.file_size_bytes === 'number' ? j.file_size_bytes : null,
  mimeType: j.mime_type ?? 'image/jpeg',
  category: j.category,
  isActiveBackground: j.is_active_background ?? false,
  displayOrder: typeof j.display_order === 'number' ? j.display_order : 0,
  isDeleted: j.is_deleted ?? false,
  uploadedAt: j.uploaded_at ? new Date(j.uploaded_at) : new Date(),
  uploadedByDevice: j.uploaded_by_device ?? null,
  metadata: j.metadata ?? {},
  isPendingUpload: j.is_pending_upload ?? false,
  localFilePath: j.local_file_path ?? null,
});

export const mediaFileToJson = (m: MediaFile): Record<string, unknown> => ({
  id: m.id,
  tenant_id: m.tenantId,
  filename: m.filename,
  url: m.url,
  file_size_bytes: m.fileSizeBytes,
  mime_type: m.mimeType,
  category: m.category,
  is_active_background: m.isActiveBackground,
  display_order: m.displayOrder,
  is_deleted: m.isDeleted,
  uploaded_at: m.uploadedAt.toISOString(),
  uploaded_by_device: m.uploadedByDevice,
  metadata: m.metadata,
  is_pending_upload: m.isPendingUpload,
  local_file_path: m.localFilePath,
});

// ── Category predicates (mirror media_file.dart getters) ──
export const isBackground = (m: MediaFile): boolean =>
  m.category === 'background' ||
  m.category === 'background_landscape' ||
  m.category === 'background_portrait';
export const isSlide = (m: MediaFile): boolean => m.category.startsWith('slide');
export const isLandscapeSlide = (m: MediaFile): boolean =>
  m.category === 'slide_landscape' || m.category === 'slide_general';
export const isPortraitSlide = (m: MediaFile): boolean =>
  m.category === 'slide_portrait' || m.category === 'slide_general';

export const fileSizeLabel = (m: MediaFile): string => {
  if (m.fileSizeBytes == null) return '';
  if (m.fileSizeBytes < 1024) return `${m.fileSizeBytes}B`;
  if (m.fileSizeBytes < 1024 * 1024) return `${(m.fileSizeBytes / 1024).toFixed(1)}KB`;
  return `${(m.fileSizeBytes / (1024 * 1024)).toFixed(1)}MB`;
};
