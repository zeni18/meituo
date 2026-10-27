<?php
/** Initialize only the dedicated local preview database; no provider requests. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { exit(1); }
$root = dirname(__DIR__);
$env = parse_ini_file($root . '/.env', true, INI_SCANNER_RAW);
$db = $env['DATABASE'] ?? [];
if (($db['HOSTNAME'] ?? '') !== '127.0.0.1' || ($db['DATABASE'] ?? '') !== 'aigc_local' || (int)($db['HOSTPORT'] ?? 0) !== 3307) {
    throw new RuntimeException('This bootstrap is restricted to the isolated local database.');
}
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=aigc_local;charset=utf8mb4', $db['USERNAME'], $db['PASSWORD'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ((int)$pdo->query('SELECT COUNT(*) FROM la_admin')->fetchColumn() === 0) {
    $salt = $env['PROJECT']['UNIQUE_IDENTIFICATION'];
    $hash = md5($salt . md5('AigcLocal2026!' . $salt));
    $now = time();
    $stmt = $pdo->prepare('INSERT INTO la_admin (id,root,name,account,password,multipoint_login,disable,create_time,update_time) VALUES (1,1,?,?,?,1,0,?,?)');
    $stmt->execute(['本地平台管理员', 'admin', $hash, $now, $now]);
    $pdo->exec('INSERT INTO la_admin_dept (admin_id,dept_id) VALUES (1,1)');
    echo "Platform admin initialized.\n";
}
if (!is_file($root . '/config/install.lock')) {
    touch($root . '/config/install.lock');
}
foreach (['runtime/local', 'runtime/sessions', 'public/uploads', 'public/storage', 'public/qrcode'] as $dir) {
    if (!is_dir($root . '/' . $dir)) { mkdir($root . '/' . $dir, 0777, true); }
}
echo 'Tables: ' . $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='aigc_local'")->fetchColumn() . "\n";
echo 'Applications: ' . $pdo->query('SELECT COUNT(*) FROM la_app')->fetchColumn() . "\n";
