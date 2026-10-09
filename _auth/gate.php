<?php
declare(strict_types=1);

// Udleverer en fil fra sitet, men kun til indloggede besøgende.
// Kaldes af .htaccess i sitets rod med ?p=<sti til filen>.

require __DIR__ . '/lib.php';
start_session();

$base = base_url();

if (!is_authed()) {
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    // Kun egentlige sidevisninger huskes som mål efter login.
    $return = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' ? safe_return($uri) : $base . '/';
    header('Cache-Control: no-store');
    header('Location: ' . $base . '/_auth/login.php?return=' . rawurlencode($return));
    exit;
}

$root = realpath(dirname(__DIR__));
$rel = str_replace('\\', '/', (string) ($_GET['p'] ?? ''));

function not_found()
{
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Siden findes ikke.';
    exit;
}

if ($rel === '' || str_contains($rel, "\0")) {
    $rel = '';
}

$segments = array_values(array_filter(explode('/', $rel), fn($s) => $s !== ''));
foreach ($segments as $s) {
    // Ingen oversigt over mapper, ingen skjulte filer, ingen opadgående stier.
    if ($s === '..' || $s[0] === '.') {
        not_found();
    }
}
if (($segments[0] ?? '') === '_auth') {
    not_found();
}

$path = realpath($root . '/' . implode('/', $segments));
if ($path === false || !str_starts_with($path . '/', $root . '/')) {
    not_found();
}

if (is_dir($path)) {
    if ($rel !== '' && !str_ends_with($rel, '/')) {
        header('Location: ' . $base . '/' . implode('/', array_map('rawurlencode', $segments)) . '/');
        exit;
    }
    $path = $path . '/index.html';
}
if (!is_file($path) || !is_readable($path)) {
    not_found();
}

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
// Kildekode og konfiguration udleveres aldrig.
if (in_array($ext, ['php', 'phtml', 'phar', 'inc', 'ini', 'env', 'log', 'sh', 'htaccess'], true)) {
    not_found();
}

$types = [
    'html' => 'text/html; charset=utf-8', 'htm' => 'text/html; charset=utf-8',
    'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8',
    'mjs' => 'text/javascript; charset=utf-8', 'json' => 'application/json; charset=utf-8',
    'csv' => 'text/csv; charset=utf-8', 'txt' => 'text/plain; charset=utf-8',
    'md' => 'text/plain; charset=utf-8', 'xml' => 'application/xml; charset=utf-8',
    'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp',
    'avif' => 'image/avif', 'ico' => 'image/x-icon', 'pdf' => 'application/pdf',
    'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf',
    'otf' => 'font/otf', 'mp4' => 'video/mp4', 'webm' => 'video/webm',
    'mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'zip' => 'application/zip',
    'webmanifest' => 'application/manifest+json',
];
$mtime = (int) filemtime($path);
$etag = '"' . dechex($mtime) . '-' . dechex((int) filesize($path)) . '"';

header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
header('Cache-Control: private, no-cache');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');

if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}

header('Content-Length: ' . filesize($path));
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
    readfile($path);
}
