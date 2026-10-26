import { connectDB, disconnectDB, mongoose } from '../../backend/src/config/database.js';
import { config } from '../../backend/src/config/env.js';
import { Product } from '../../backend/src/models/Product.js';
import { ProductDetail } from '../../backend/src/models/ProductDetail.js';
import { ProductPricing } from '../../backend/src/models/ProductPricing.js';

export async function runVerticalMigration({ targetUri = null, quiet = false } = {}) {
  const log = (...args) => { if (!quiet) console.log(...args); };

  const effectiveUri = targetUri || process.env.MONGODB_URI || config.mongoUri;

  log('================================================================');
  log(' Distributed Inventory: Idempotent Vertical Fragmentation Migration');
  log('================================================================');
  log(`[Target URI] Connecting to: ${effectiveUri}`);

  const conn = await connectDB(effectiveUri);
  if (!conn || mongoose.connection.readyState !== 1) {
    throw new Error(`Database connection failed for ${effectiveUri}. Ensure MongoDB is running.`);
  }

  const db = mongoose.connection.db;
  log(`[Database Connected] Host: ${conn.host}:${conn.port} | Database: ${db.databaseName}`);

  try {
    // Step 1: Inspect existing products collection
    const productsCollection = db.collection('products');
    const existingProducts = await productsCollection.find().toArray();
    log(`[Inspection] Found ${existingProducts.length} original product records in "products".`);

    if (existingProducts.length === 0) {
      log('[Notice] Original "products" collection is empty. Nothing to migrate.');
      return { success: true, migrated: 0, skipped: 0, errors: 0 };
    }

    // Step 2: Ensure target fragment collections and unique indexes
    const detailsCollection = db.collection('product_details');
    const pricingCollection = db.collection('product_pricing');

    log('[Indexes] Ensuring unique indexes on "sku" for both fragments...');
    await detailsCollection.createIndex({ sku: 1 }, { unique: true });
    await detailsCollection.createIndex({ category: 1 });
    await pricingCollection.createIndex({ sku: 1 }, { unique: true });
    log('[Indexes] Unique indexes confirmed: { sku: 1 } (unique).');

    // Step 3: Iterate through existing products with safety guards
    let migratedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const seenSkus = new Set();

    for (const prod of existingProducts) {
      const rawSku = prod.sku;
      if (!rawSku || typeof rawSku !== 'string') {
        errors.push({ id: prod._id, error: 'Product is missing a valid string SKU' });
        continue;
      }

      const upperSku = rawSku.toUpperCase().trim();

      // Guard against duplicate SKUs within original collection
      if (seenSkus.has(upperSku)) {
        errors.push({ sku: upperSku, id: prod._id, error: 'Duplicate SKU encountered in products collection' });
        continue;
      }
      seenSkus.add(upperSku);

      // Validate required product fields
      if (!prod.name || !prod.category || prod.costPrice === undefined || prod.sellingPrice === undefined) {
        errors.push({ sku: upperSku, id: prod._id, error: 'Product is missing mandatory name, category, or pricing attributes' });
        continue;
      }

      // Check existing fragment entries for idempotency
      const [existingDetail, existingPricing] = await Promise.all([
        detailsCollection.findOne({ sku: upperSku }),
        pricingCollection.findOne({ sku: upperSku }),
      ]);

      let detailAction = 'SKIPPED';
      let pricingAction = 'SKIPPED';

      // 3a. Migrate to product_details (Descriptive attributes)
      if (!existingDetail) {
        const detailDoc = {
          _id: prod._id, // Preserve original ObjectId for foreign key / detail links
          sku: upperSku,
          name: prod.name.trim(),
          description: prod.description || '',
          category: prod.category.trim(),
          reorderLevel: typeof prod.reorderLevel === 'number' ? prod.reorderLevel : 10,
          unit: prod.unit || 'units',
          createdAt: prod.createdAt || new Date(),
          updatedAt: prod.updatedAt || new Date(),
        };
        await detailsCollection.insertOne(detailDoc);
        detailAction = 'INSERTED';
      }

      // 3b. Migrate to product_pricing (Financial attributes)
      if (!existingPricing) {
        const pricingDoc = {
          sku: upperSku,
          costPrice: Number(prod.costPrice),
          sellingPrice: Number(prod.sellingPrice),
          currency: 'USD',
          pricingTier: 'STANDARD',
          createdAt: prod.createdAt || new Date(),
          updatedAt: prod.updatedAt || new Date(),
        };
        await pricingCollection.insertOne(pricingDoc);
        pricingAction = 'INSERTED';
      }

      if (detailAction === 'INSERTED' || pricingAction === 'INSERTED') {
        migratedCount++;
        log(`[Migrated] SKU: ${upperSku.padEnd(14)} | details: ${detailAction.padEnd(8)} | pricing: ${pricingAction}`);
      } else {
        skippedCount++;
        log(`[Idempotent] SKU: ${upperSku.padEnd(14)} | already present in both fragments.`);
      }
    }

    // Step 4: Verification and Parity Audit
    const totalDetails = await detailsCollection.countDocuments();
    const totalPricing = await pricingCollection.countDocuments();
    const totalOriginal = await productsCollection.countDocuments();

    log('\n================================================================');
    log(' Vertical Fragmentation Migration Summary');
    log('================================================================');
    log(`Original "products" count:        ${totalOriginal}`);
    log(`"product_details" fragment count:  ${totalDetails}`);
    log(`"product_pricing" fragment count:  ${totalPricing}`);
    log(`Records newly migrated:            ${migratedCount}`);
    log(`Records skipped (already present): ${skippedCount}`);
    log(`Validation / duplicate errors:     ${errors.length}`);

    if (errors.length > 0) {
      log('\n[Warnings/Errors]:');
      errors.forEach(e => log(`  - SKU: ${e.sku || 'N/A'}, Error: ${e.error}`));
    }

    const isParity = (totalDetails === totalOriginal) && (totalPricing === totalOriginal);
    log(`\nFragment Parity Status: ${isParity ? '✔ PERFECT PARITY (100% matched)' : '⚠ PARITY DISCREPANCY DETECTED'}`);
    log('================================================================\n');

    return {
      success: errors.length === 0,
      totalOriginal,
      totalDetails,
      totalPricing,
      migratedCount,
      skippedCount,
      errors,
      isParity,
    };
  } finally {
    await disconnectDB();
  }
}

// Allow direct CLI execution: node migrate-vertical-fragmentation.js
if (process.argv[1] && process.argv[1].endsWith('migrate-vertical-fragmentation.js')) {
  runVerticalMigration()
    .then(res => {
      console.log('Migration script finished cleanly.');
      process.exit(res.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal migration failure:', err);
      process.exit(1);
    });
}
