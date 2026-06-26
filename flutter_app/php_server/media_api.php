<?php
/**
 * media_api.php
 * Masjid Azan — Media Library API
 *
 * Actions: upload | delete | exists | list | info
 *
 * Deploy at: /softwares/general_upload/masjidazan/media_api.php
 * Files stored in: /softwares/general_upload/masjidazan/uploads/
 */

// ── CORS (allow Flutter web + Android) ───────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Auth ──────────────────────────────────────────────────────
define('API_KEY', 'EverY0NeKnoW$1T');
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('UPLOAD_URL', 'https://expertai.co.uk/softwares/general_upload/masjidazan/uploads/');
define('MAX_FILE_SIZE', 20 * 1024 * 1024); // 20 MB

function checkAuth() {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($auth !== 'Bearer ' . API_KEY) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
}

function jsonOk($data) {
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

function jsonError($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

// ── Route ─────────────────────────────────────────────────────
checkAuth();

// Determine action: POST body JSON or form field or GET param
$action = null;
$body = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $body = json_decode($raw, true) ?? [];
    }
    $action = $body['action'] ?? $_POST['action'] ?? null;
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? null;
}

if (!$action) {
    jsonError('Missing action parameter. Valid: upload | delete | exists | list | info');
}

// ── Ensure upload directory exists ────────────────────────────
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// ═════════════════════════════════════════════════════════════
// ACTION: upload
// ═════════════════════════════════════════════════════════════
if ($action === 'upload') {
    if (empty($_FILES['file'])) {
        jsonError('No file provided in multipart form field "file"');
    }

    $file  = $_FILES['file'];
    $error = $file['error'];

    if ($error !== UPLOAD_ERR_OK) {
        $msgs = [
            UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds form MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temp folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write to disk',
            UPLOAD_ERR_EXTENSION  => 'Upload stopped by extension',
        ];
        jsonError($msgs[$error] ?? "Upload error code $error");
    }

    if ($file['size'] > MAX_FILE_SIZE) {
        jsonError('File too large (max 20 MB)');
    }

    // Validate image MIME
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!in_array($mime, $allowedMimes)) {
        jsonError("File type not allowed: $mime");
    }

    // Build safe filename: timestamp + random + original ext
    $origName = basename($file['name']);
    $ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $safeName = time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    $destPath = UPLOAD_DIR . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        jsonError('Failed to move uploaded file to destination', 500);
    }

    $url = UPLOAD_URL . $safeName;
    jsonOk([
        'url'       => $url,
        'filename'  => $safeName,
        'original'  => $origName,
        'size'      => $file['size'],
        'mime_type' => $mime,
    ]);
}

// ═════════════════════════════════════════════════════════════
// ACTION: delete
// ═════════════════════════════════════════════════════════════
if ($action === 'delete') {
    $filename = $body['filename'] ?? $_POST['filename'] ?? null;
    if (!$filename) {
        jsonError('Missing filename parameter');
    }

    // Security: strip any path traversal, allow only basename
    $filename = basename($filename);
    if (empty($filename) || $filename === '.' || $filename === '..') {
        jsonError('Invalid filename');
    }

    $filePath = UPLOAD_DIR . $filename;
    if (!file_exists($filePath)) {
        // Already gone — treat as success (idempotent)
        jsonOk(['deleted' => false, 'message' => 'File not found (already deleted)']);
    }

    if (unlink($filePath)) {
        jsonOk(['deleted' => true, 'filename' => $filename]);
    } else {
        jsonError('Failed to delete file', 500);
    }
}

// ═════════════════════════════════════════════════════════════
// ACTION: exists
// ═════════════════════════════════════════════════════════════
if ($action === 'exists') {
    $filename = $body['filename'] ?? $_GET['filename'] ?? null;
    if (!$filename) {
        jsonError('Missing filename parameter');
    }

    $filename = basename($filename);
    $filePath = UPLOAD_DIR . $filename;
    $exists   = file_exists($filePath);

    jsonOk([
        'exists'   => $exists,
        'filename' => $filename,
        'url'      => $exists ? UPLOAD_URL . $filename : null,
        'size'     => $exists ? filesize($filePath) : null,
    ]);
}

// ═════════════════════════════════════════════════════════════
// ACTION: list
// ═════════════════════════════════════════════════════════════
if ($action === 'list') {
    $allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

    $files = [];
    foreach (scandir(UPLOAD_DIR) as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $path = UPLOAD_DIR . $entry;
        if (!is_file($path)) continue;
        $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt)) continue;

        $files[] = [
            'filename'    => $entry,
            'url'         => UPLOAD_URL . $entry,
            'size'        => filesize($path),
            'modified_at' => date('c', filemtime($path)),
        ];
    }

    // Sort newest first
    usort($files, fn($a, $b) => strcmp($b['modified_at'], $a['modified_at']));

    jsonOk(['files' => $files, 'count' => count($files)]);
}

// ═════════════════════════════════════════════════════════════
// ACTION: info  (get size + last-modified for a single file)
// ═════════════════════════════════════════════════════════════
if ($action === 'info') {
    $filename = $body['filename'] ?? $_GET['filename'] ?? null;
    if (!$filename) {
        jsonError('Missing filename parameter');
    }

    $filename = basename($filename);
    $filePath = UPLOAD_DIR . $filename;

    if (!file_exists($filePath)) {
        jsonOk(['exists' => false, 'filename' => $filename]);
    }

    jsonOk([
        'exists'      => true,
        'filename'    => $filename,
        'url'         => UPLOAD_URL . $filename,
        'size'        => filesize($filePath),
        'modified_at' => date('c', filemtime($filePath)),
        'mime_type'   => mime_content_type($filePath),
    ]);
}

// ── Unknown action ────────────────────────────────────────────
jsonError("Unknown action '$action'. Valid: upload | delete | exists | list | info");
