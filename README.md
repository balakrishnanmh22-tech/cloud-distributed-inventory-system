# Cloud-Based Distributed Inventory Management System
Please navigate to the project directory:
[cloud-distributed-inventory/README.md](file:///F:/DD%20MP/cloud-distributed-inventory/README.md)

### Quick Commands (from root):
- **Backend Test**: `npm --prefix cloud-distributed-inventory\backend test`
- **Backend Seed**: `npm --prefix cloud-distributed-inventory\backend run seed`
- **Backend Start**: `npm --prefix cloud-distributed-inventory\backend start`
- **Frontend Dev**: `npm --prefix cloud-distributed-inventory\frontend run dev`
- **Frontend Build**: `npm --prefix cloud-distributed-inventory\frontend run build`
- **Horizontal Fragmentation Test**: `node cloud-distributed-inventory\tests\fragmentation\test-fragmentation.js`
- **Vertical Fragmentation Migration**: `npm --prefix cloud-distributed-inventory\backend run migrate:vertical`
- **Vertical Fragmentation Test**: `npm --prefix cloud-distributed-inventory\backend run test:vertical`
- **ACID Transfer Test**: `node cloud-distributed-inventory\tests\transactions\test-acid-transfer.js`
- **Concurrency Test**: `node cloud-distributed-inventory\tests\concurrency\test-concurrency.js`
- **CAP Experiment Test**: `node cloud-distributed-inventory\tests\cap\test-cap-base.js`
- **Scalability Test**: `node cloud-distributed-inventory\tests\scalability\load-test.js`
