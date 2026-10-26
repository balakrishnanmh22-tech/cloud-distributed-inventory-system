// MongoDB Replica Set Initialization Script for rs0
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 2 },
    { _id: 1, host: "mongo2:27017", priority: 1 },
    { _id: 2, host: "mongo3:27017", priority: 1 }
  ]
});

print("[Replica Set] Initiation command issued for rs0.");
sleep(2000);
printjson(rs.status());
