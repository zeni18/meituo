<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
$root=dirname(__DIR__);$local=__DIR__.'/local';
$env=parse_ini_file($root.'/.env',true,INI_SCANNER_RAW);$db=$env['DATABASE'];
if($db['HOSTNAME']!=='127.0.0.1'||!preg_match('/^aigc_dev_(?:primary|secondary)_\d+$/D',$db['DATABASE'])||(int)$db['HOSTPORT']<3310)throw new RuntimeException('Only an isolated collaboration database is allowed');
$pdo=new PDO('mysql:host=127.0.0.1;port='.$db['HOSTPORT'].';charset=utf8mb4',$db['USERNAME'],$db['PASSWORD'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$database=$db['DATABASE'];
$count=(int)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=".$pdo->quote($database))->fetchColumn();
if($count!==0)throw new RuntimeException('Database is not empty. Initialization never overwrites an existing database.');
$pdo->exec('CREATE DATABASE IF NOT EXISTS `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('USE `'.$database.'`');$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
$schema=json_decode(file_get_contents(__DIR__.'/seed/schema.json'),true,512,JSON_THROW_ON_ERROR);
foreach($schema as $sql)$pdo->exec($sql);
$seed=json_decode(file_get_contents(__DIR__.'/seed/catalog.json'),true,512,JSON_THROW_ON_ERROR);
$password='Dev-'.bin2hex(random_bytes(10)).'!';
$salt=$env['PROJECT']['UNIQUE_IDENTIFICATION'];$hash=md5($salt.md5($password.$salt));
$pdo->beginTransaction();
foreach($seed as $table=>$rows){
 if(!preg_match('/^[a-zA-Z0-9_]+$/D',$table))throw new RuntimeException('Invalid seed table');
 foreach($rows as $row){
  if(in_array($table,['la_admin','la_tenant_admin','la_user'],true))$row['password']=$hash;
  $keys=array_keys($row);foreach($keys as $key)if(!preg_match('/^[a-zA-Z0-9_]+$/D',$key))throw new RuntimeException('Invalid seed column');
  $sql='INSERT INTO `'.$table.'` (`'.implode('`,`',$keys).'`) VALUES ('.implode(',',array_fill(0,count($keys),'?')).')';
  $pdo->prepare($sql)->execute(array_values($row));
 }
}
$pdo->commit();$pdo->exec('SET FOREIGN_KEY_CHECKS=1');
foreach(['runtime/local','runtime/sessions','public/uploads','public/storage','public/qrcode'] as $directory)if(!is_dir($root.'/'.$directory))mkdir($root.'/'.$directory,0777,true);
touch($root.'/config/install.lock');
file_put_contents($local.'/accounts.txt',"Local development only\nMerchant account: demo2026\nPlatform/OEM account: admin\nPassword: $password\nEach machine gets a different random password.\n");
echo 'Initialized '.count($schema)." empty-schema tables and sanitized developer catalog. Accounts saved locally; no original accounts, tasks or provider keys imported.\n";
