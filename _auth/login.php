<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
start_session();

$base = base_url();
$navn = (string) cfg()['site_navn'];
$return = safe_return((string) ($_GET['return'] ?? $_POST['return'] ?? ''));

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

if (isset($_GET['logud'])) {
    $_SESSION = [];
    session_regenerate_id(true);
    header('Location: ' . $base . '/_auth/login.php?ud=1');
    exit;
}

$fejl = '';
$besked = isset($_GET['ud']) ? 'Du er logget ud.' : '';
$konfigureret = (string) cfg()['adgangskode_hash'] !== '';

if (is_authed() && $_SERVER['REQUEST_METHOD'] !== 'POST' && !isset($_GET['ud'])) {
    header('Location: ' . $return);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $min = locked_minutes();
    if (!hash_equals(csrf_token(), (string) ($_POST['csrf'] ?? ''))) {
        $fejl = 'Siden var udløbet. Prøv igen.';
    } elseif ($min > 0) {
        $fejl = "For mange forkerte forsøg. Prøv igen om $min min.";
    } elseif (!$konfigureret) {
        $fejl = 'Adgangskoden er ikke sat op på serveren endnu.';
    } elseif (verify_password((string) ($_POST['kode'] ?? ''), (string) cfg()['adgangskode_hash'])) {
        clear_failures();
        session_regenerate_id(true);
        $_SESSION['ok'] = true;
        $_SESSION['sidst'] = time();
        header('Location: ' . $return);
        exit;
    } else {
        register_failure();
        usleep(500000);
        $min = locked_minutes();
        $fejl = $min > 0
            ? "For mange forkerte forsøg. Prøv igen om $min min."
            : 'Forkert adgangskode.';
    }
}

$h = fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
?>
<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Log ind – <?= $h($navn) ?></title>
  <style>
    :root { --primaer: #154482; --primaer-moerk: #0e3260; --hvid: #fff; --tekst: #1b2433; --graa: #5b6678; --kant: #c9d2e0; --fejl: #a4262c; --fejl-bg: #fdecec; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { margin: 0; display: grid; place-items: center; padding: 16px; background: var(--primaer); color: var(--tekst); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .kort { width: 100%; max-width: 400px; background: var(--hvid); border-radius: 12px; padding: 36px 32px 32px; box-shadow: 0 12px 40px rgba(0, 0, 0, .25); }
    .laas { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; background: var(--primaer); display: grid; place-items: center; }
    .laas svg { width: 28px; height: 28px; }
    h1 { margin: 0 0 4px; text-align: center; font-size: 1.5rem; color: var(--primaer); }
    .under { margin: 0 0 24px; text-align: center; color: var(--graa); font-size: .95rem; }
    label { display: block; margin-bottom: 6px; font-weight: 600; font-size: .95rem; }
    .felt { position: relative; }
    input[type=password], input[type=text] { width: 100%; padding: 12px 84px 12px 14px; font: inherit; color: var(--tekst); background: var(--hvid); border: 2px solid var(--kant); border-radius: 8px; }
    input:focus { outline: none; border-color: var(--primaer); box-shadow: 0 0 0 3px rgba(21, 68, 130, .25); }
    .vis { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); padding: 6px 10px; font: inherit; font-size: .85rem; color: var(--primaer); background: none; border: 0; border-radius: 6px; cursor: pointer; }
    .vis:hover { background: #e8eef7; }
    .vis:focus-visible { outline: 2px solid var(--primaer); }
    button.log { width: 100%; margin-top: 20px; padding: 12px; font: inherit; font-weight: 600; color: var(--hvid); background: var(--primaer); border: 0; border-radius: 8px; cursor: pointer; }
    button.log:hover { background: var(--primaer-moerk); }
    button.log:focus-visible { outline: 3px solid var(--primaer); outline-offset: 2px; }
    .besked { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; font-size: .95rem; }
    .fejl { color: var(--fejl); background: var(--fejl-bg); border: 1px solid #f0b8bb; }
    .info { color: var(--primaer); background: #e8eef7; border: 1px solid #c3d3ea; }
  </style>
</head>
<body>
  <main class="kort">
    <div class="laas" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
    </div>
    <h1><?= $h($navn) ?></h1>
    <p class="under">Indtast adgangskoden for at fortsætte</p>

    <?php if ($fejl): ?><p class="besked fejl" role="alert"><?= $h($fejl) ?></p><?php endif; ?>
    <?php if ($besked && !$fejl): ?><p class="besked info" role="status"><?= $h($besked) ?></p><?php endif; ?>

    <form method="post" action="<?= $h($base) ?>/_auth/login.php">
      <input type="hidden" name="csrf" value="<?= $h(csrf_token()) ?>">
      <input type="hidden" name="return" value="<?= $h($return) ?>">
      <label for="kode">Adgangskode</label>
      <div class="felt">
        <input id="kode" name="kode" type="password" autocomplete="current-password" required autofocus>
        <button type="button" class="vis" id="vis" aria-controls="kode" aria-pressed="false">Vis</button>
      </div>
      <button type="submit" class="log">Log ind</button>
    </form>
  </main>
  <script>
    var k = document.getElementById('kode'), v = document.getElementById('vis');
    v.addEventListener('click', function () {
      var vis = k.type === 'password';
      k.type = vis ? 'text' : 'password';
      v.textContent = vis ? 'Skjul' : 'Vis';
      v.setAttribute('aria-pressed', String(vis));
      k.focus();
    });
  </script>
</body>
</html>
