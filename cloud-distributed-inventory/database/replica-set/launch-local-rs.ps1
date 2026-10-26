# Launch Native 3-Member MongoDB Replica Set on Windows
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DataDir = Join-Path $BaseDir "..\..\.mongo_data"
$MongoBin = "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe"
if (-not (Test-Path $MongoBin)) {
    $MongoBin = (Get-Command mongod -ErrorAction SilentlyContinue).Source
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Starting 3-Member MongoDB Replica Set (rs0) Locally   " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Create Data Directories
New-Item -ItemType Directory -Path "$DataDir\node1", "$DataDir\node2", "$DataDir\node3" -Force | Out-Null
Write-Host "[1/4] Created replica set data directories in $DataDir" -ForegroundColor Green

# 2. Launch 3 mongod instances
Write-Host "[2/4] Spawning Member 1 (Port 27018), Member 2 (Port 27019), Member 3 (Port 27020)..." -ForegroundColor Yellow
$p1 = Start-Process -FilePath $MongoBin -ArgumentList "--replSet rs0 --port 27018 --dbpath `"$DataDir\node1`" --bind_ip 127.0.0.1" -PassThru
$p2 = Start-Process -FilePath $MongoBin -ArgumentList "--replSet rs0 --port 27019 --dbpath `"$DataDir\node2`" --bind_ip 127.0.0.1" -PassThru
$p3 = Start-Process -FilePath $MongoBin -ArgumentList "--replSet rs0 --port 27020 --dbpath `"$DataDir\node3`" --bind_ip 127.0.0.1" -PassThru

# Save PIDs to file for clean termination
"$($p1.Id)`n$($p2.Id)`n$($p3.Id)" | Set-Content (Join-Path $BaseDir "replica_pids.txt")

Write-Host "[3/4] Waiting 5 seconds for nodes to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 3. Initiate Replica Set rs0
Write-Host "[4/4] Initiating replica set rs0..." -ForegroundColor Cyan
$initCmd = "rs.initiate({ _id: 'rs0', members: [ { _id: 0, host: '127.0.0.1:27018', priority: 2 }, { _id: 1, host: '127.0.0.1:27019', priority: 1 }, { _id: 2, host: '127.0.0.1:27020', priority: 1 } ] })"
mongosh --port 27018 --eval $initCmd

Start-Sleep -Seconds 3
mongosh --port 27018 --eval "rs.status().members.map(m => ({ id: m._id, name: m.name, stateStr: m.stateStr, health: m.health }))"

Write-Host "`nReplica set rs0 is running!" -ForegroundColor Green
Write-Host "Connection URI: mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/distributed_inventory?replicaSet=rs0" -ForegroundColor Cyan
