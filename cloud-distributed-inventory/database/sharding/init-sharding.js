// MongoDB Sharded Cluster Configuration Script
// Run against mongos router (port 27017)

// 1. Register Shards
sh.addShard("shard1-rs/shard1-0.shard1-service.cloud-inventory.svc.cluster.local:27017");
sh.addShard("shard2-rs/shard2-0.shard2-service.cloud-inventory.svc.cluster.local:27017");

// 2. Enable Sharding on Database
sh.enableSharding("distributed_inventory");

// 3. Shard Collection with Compound Shard Key { warehouseId: 1, sku: 1 }
// Ensures all inventory for a given warehouse is grouped on chunks, preserving data locality
sh.shardCollection("distributed_inventory.global_inventory", { warehouseId: 1, sku: 1 });

// 4. Print Status
print("[Sharding] Sharded cluster status:");
printjson(sh.status());
