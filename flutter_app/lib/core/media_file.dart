/// media_file.dart
/// Model for files stored in the Supabase `media_library` table,
/// and for locally imported files that are pending upload.

class MediaFile {
  final String id;          // UUID from Supabase, or 'pending_xxx' for local-only
  final String tenantId;
  final String filename;
  final String url;         // https:// URL on PHP server, or local file path if pending
  final int? fileSizeBytes;
  final String mimeType;
  final String category;    // 'background_landscape' | 'background_portrait' | 'background' | 'slide_landscape' | 'slide_portrait' | 'slide_general'
  final bool isActiveBackground;
  final int displayOrder;
  final bool isDeleted;
  final DateTime uploadedAt;
  final String? uploadedByDevice;
  final Map<String, dynamic> metadata;

  /// True when imported locally (no internet). File lives on device only.
  /// Will be auto-uploaded when internet returns.
  final bool isPendingUpload;

  /// Absolute local file path — set for pending uploads and locally cached files.
  final String? localFilePath;

  const MediaFile({
    required this.id,
    required this.tenantId,
    required this.filename,
    required this.url,
    this.fileSizeBytes,
    this.mimeType = 'image/jpeg',
    required this.category,
    this.isActiveBackground = false,
    this.displayOrder = 0,
    this.isDeleted = false,
    required this.uploadedAt,
    this.uploadedByDevice,
    this.metadata = const {},
    this.isPendingUpload = false,
    this.localFilePath,
  });

  factory MediaFile.fromJson(Map<String, dynamic> json) => MediaFile(
        id: json['id'] as String,
        tenantId: json['tenant_id'] as String,
        filename: json['filename'] as String,
        url: json['url'] as String,
        fileSizeBytes: (json['file_size_bytes'] as num?)?.toInt(),
        mimeType: json['mime_type'] as String? ?? 'image/jpeg',
        category: json['category'] as String,
        isActiveBackground: json['is_active_background'] as bool? ?? false,
        displayOrder: (json['display_order'] as num?)?.toInt() ?? 0,
        isDeleted: json['is_deleted'] as bool? ?? false,
        uploadedAt: json['uploaded_at'] != null
            ? DateTime.parse(json['uploaded_at'] as String)
            : DateTime.now(),
        uploadedByDevice: json['uploaded_by_device'] as String?,
        metadata: (json['metadata'] as Map<String, dynamic>?) ?? {},
        isPendingUpload: json['is_pending_upload'] as bool? ?? false,
        localFilePath: json['local_file_path'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'tenant_id': tenantId,
        'filename': filename,
        'url': url,
        'file_size_bytes': fileSizeBytes,
        'mime_type': mimeType,
        'category': category,
        'is_active_background': isActiveBackground,
        'display_order': displayOrder,
        'is_deleted': isDeleted,
        'uploaded_at': uploadedAt.toIso8601String(),
        'uploaded_by_device': uploadedByDevice,
        'metadata': metadata,
        'is_pending_upload': isPendingUpload,
        'local_file_path': localFilePath,
      };

  MediaFile copyWith({
    bool? isActiveBackground,
    int? displayOrder,
    bool? isDeleted,
    bool? isPendingUpload,
    String? localFilePath,
    Map<String, dynamic>? metadata,
  }) =>
      MediaFile(
        id: id,
        tenantId: tenantId,
        filename: filename,
        url: url,
        fileSizeBytes: fileSizeBytes,
        mimeType: mimeType,
        category: category,
        isActiveBackground: isActiveBackground ?? this.isActiveBackground,
        displayOrder: displayOrder ?? this.displayOrder,
        isDeleted: isDeleted ?? this.isDeleted,
        uploadedAt: uploadedAt,
        uploadedByDevice: uploadedByDevice,
        metadata: metadata ?? this.metadata,
        isPendingUpload: isPendingUpload ?? this.isPendingUpload,
        localFilePath: localFilePath ?? this.localFilePath,
      );

  /// The best URL to use for display: local file path if available, else cloud URL.
  String get displayPath => localFilePath ?? url;

  String get fileSizeLabel {
    if (fileSizeBytes == null) return '';
    if (fileSizeBytes! < 1024) return '${fileSizeBytes}B';
    if (fileSizeBytes! < 1024 * 1024) return '${(fileSizeBytes! / 1024).toStringAsFixed(1)}KB';
    return '${(fileSizeBytes! / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  bool get isBackground => category == 'background' || category == 'background_landscape' || category == 'background_portrait';
  bool get isLandscapeBg => category == 'background_landscape' || category == 'background';
  bool get isPortraitBg => category == 'background_portrait' || category == 'background';
  bool get isSlide => category.startsWith('slide');
  bool get isLandscapeSlide => category == 'slide_landscape' || category == 'slide_general';
  bool get isPortraitSlide => category == 'slide_portrait' || category == 'slide_general';
}
