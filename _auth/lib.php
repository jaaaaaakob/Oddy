<?php
declare(strict_types=1);

// Fælles funktioner for login.php og gate.php.

function cfg(): array
{
    static $c = null;
    if ($c === null) {
        $c = require __DIR__ . '/config.php';
    }
    return $c;
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['SERVER_PORT'] ?? '') === '443'
        || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

/** URL-sti til sitets rod, uden afsluttende skråstreg ('' hvis roden). */
function base_url(): string
{
    $dir = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME']))), '/');
    return $dir === '.' ? '' : $dir;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $timeout = max(1, (int) cfg()['timeout_minutter']) * 60;
    ini_set('session.gc_maxlifetime', (string) $timeout);
    ini_set('session.use_strict_mode', '1');
    session_name('adgang_' . substr(sha1(__DIR__), 0, 8));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => base_url() . '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    if (!empty($_SESSION['ok']) && time() - ($_SESSION['sidst'] ?? 0) > $timeout) {
        $_SESSION = [];
    }
    if (!empty($_SESSION['ok'])) {
        $_SESSION['sidst'] = time();
    }
}

function is_authed(): bool
{
    return !empty($_SESSION['ok']);
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

/** Accepterer kun lokale stier som mål efter login (ingen omdirigering til andre sites). */
function safe_return(string $r): string
{
    $base = base_url();
    if ($r === '' || $r[0] !== '/' || str_starts_with($r, '//') || str_contains($r, '\\')
        || preg_match('/[\x00-\x1f]/', $r)) {
        return $base . '/';
    }
    if ($base !== '' && !str_starts_with($r, $base . '/') && $r !== $base) {
        return $base . '/';
    }
    if (str_contains($r, '/_auth/')) {
        return $base . '/';
    }
    return $r;
}

/**
 * Format: pbkdf2$sha256$<iterationer>$<salt>$<hex>  (fra lav-adgangskode.html)
 * Almindelige password_hash()-hashes ($2y$ ...) virker også.
 */
function verify_password(string $password, string $stored): bool
{
    if ($stored === '') {
        return false;
    }
    if (str_starts_with($stored, 'pbkdf2$')) {
        $p = explode('$', $stored);
        if (count($p) !== 5 || $p[1] !== 'sha256') {
            return false;
        }
        $calc = hash_pbkdf2('sha256', $password, $p[3], (int) $p[2], 0, false);
        return hash_equals($p[4], $calc);
    }
    return password_verify($password, $stored);
}

// --- Spærring mod gætteri (pr. IP-adresse) ---

function attempts_file(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    return $dir . '/forsog.json';
}

function attempts_load(): array
{
    $f = attempts_file();
    $d = is_file($f) ? json_decode((string) @file_get_contents($f), true) : null;
    return is_array($d) ? $d : [];
}

function attempts_save(array $d): void
{
    $cut = time() - 86400;
    foreach ($d as $k => $v) {
        if (($v['sidst'] ?? 0) < $cut) {
            unset($d[$k]);
        }
    }
    @file_put_contents(attempts_file(), json_encode($d), LOCK_EX);
}

function client_key(): string
{
    return hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'ukendt');
}

/** Antal minutter tilbage af en spærring, ellers 0. */
function locked_minutes(): int
{
    $e = attempts_load()[client_key()] ?? null;
    if ($e && ($e['laast_til'] ?? 0) > time()) {
        return (int) ceil(($e['laast_til'] - time()) / 60);
    }
    return 0;
}

function register_failure(): void
{
    $d = attempts_load();
    $k = client_key();
    $e = $d[$k] ?? ['antal' => 0];
    if (($e['laast_til'] ?? 0) && $e['laast_til'] <= time()) {
        $e = ['antal' => 0];
    }
    $e['antal'] = ($e['antal'] ?? 0) + 1;
    $e['sidst'] = time();
    if ($e['antal'] >= (int) cfg()['max_forsog']) {
        $e['laast_til'] = time() + (int) cfg()['laas_minutter'] * 60;
        $e['antal'] = 0;
    }
    $d[$k] = $e;
    attempts_save($d);
}

function clear_failures(): void
{
    $d = attempts_load();
    unset($d[client_key()]);
    attempts_save($d);
}
