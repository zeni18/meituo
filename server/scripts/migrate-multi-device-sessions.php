<?php
declare(strict_types=1);
// CLI only. Run a dry check first; production requires an explicit database name.
if (PHP_SAPI !== 'cli') exit(1);
$options = getopt('', ['root:', 'expected-db:', 'apply']);
$root = $options['root'] ?? dirname(__DIR__);
require $root . '/runtime-loader.php';
$app = new AigcRuntimeApp($root); $app->initialize();
use think\facade\Db;
$database = (string)config('database.connections.mysql.database');
if (!str_starts_with($database, 'aigc_dev_') && ($options['expected-db'] ?? '') !== $database) throw new RuntimeException('Explicit expected database required');
$prefix = (string)config('database.connections.mysql.prefix');
if (!preg_match('/^[A-Za-z0-9_]+$/D', $prefix)) throw new RuntimeException('Invalid database prefix');
$tables = Db::query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [$database]);
$result = []; $plan = [];
foreach ($tables as $row) {
    $table = $row['name'];
    if (!preg_match('/^' . preg_quote($prefix, '/') . '(user_session|tenant_admin_session|admin_session)(?:_[A-Za-z0-9_-]+)?$/D', $table, $match)) continue;
    $user = $match[1] === 'user_session';
    $indexes = [];
    foreach (Db::query("SHOW INDEX FROM `$table`") as $index) {
        $key = $index['Key_name'];
        $indexes[$key]['unique'] = (int)$index['Non_unique'] === 0;
        $indexes[$key]['columns'][(int)$index['Seq_in_index']] = $index['Column_name'];
    }
    $tokenUnique = false; $changes = [];
    foreach ($indexes as $key => $index) {
        ksort($index['columns']); $columns = array_values($index['columns']);
        if ($index['unique'] && $columns === ['token']) $tokenUnique = true;
        $accountColumns = $columns; sort($accountColumns);
        $expected = $user ? ['terminal', 'user_id'] : ['admin_id', 'terminal'];
        $expectedTenant = $expected; $expectedTenant[] = 'tenant_id'; sort($expectedTenant);
        if ($index['unique'] && ($accountColumns === $expected || $accountColumns === $expectedTenant)) {
            if (!preg_match('/^[A-Za-z0-9_]+$/D', $key)) throw new RuntimeException('Invalid index identifier');
            $fields = $user ? ['tenant_id', 'user_id', 'terminal'] : $columns;
            $sql = "ALTER TABLE `$table` DROP INDEX `$key`, ADD INDEX `$key` (`" . implode('`,`', $fields) . '`)';
            $changes[] = ['index' => $key, 'columns' => $fields];
            $plan[] = $sql;
        }
    }
    if (!$tokenUnique) throw new RuntimeException('Unique token index missing: ' . $table);
    $result[] = ['table' => $table, 'rows' => Db::table($table)->count(), 'changes' => $changes];
}
if (count($result) < 3) throw new RuntimeException('Expected session tables missing');
// Validate every table before making any schema change. No session rows are deleted.
if (isset($options['apply'])) foreach ($plan as $sql) Db::execute($sql);
echo json_encode(['database' => $database, 'applied' => isset($options['apply']), 'tables' => $result], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
