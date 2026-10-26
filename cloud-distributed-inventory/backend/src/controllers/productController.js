import { ProductService } from '../services/productService.js';

export async function getProducts(req, res, next) {
  try {
    const { search, category, warehouse, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
    const result = await ProductService.getProducts({
      search,
      category,
      warehouse,
      page,
      limit,
      sortBy,
      order,
    });

    res.json({
      success: true,
      products: result.products,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const product = await ProductService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({
      success: true,
      product,
    });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    const {
      sku,
      name,
      description,
      category,
      costPrice,
      sellingPrice,
      reorderLevel,
      unit,
      initialStock = 0,
      initialWarehouse = 'HOSUR',
    } = req.body;

    if (!sku || !name || !category || costPrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: 'SKU, name, category, costPrice, and sellingPrice are required',
      });
    }

    try {
      const product = await ProductService.createProduct({
        sku,
        name,
        description,
        category,
        costPrice,
        sellingPrice,
        reorderLevel,
        unit,
        initialStock,
        initialWarehouse,
        performedBy: req.user?.username || 'admin',
      });

      res.status(201).json({
        success: true,
        message: 'Product created and partition initialized successfully',
        product,
      });
    } catch (err) {
      if (err.message?.includes('already exists') || err.code === 11000) {
        return res.status(409).json({ success: false, error: err.message });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { name, description, category, costPrice, sellingPrice, reorderLevel, unit } = req.body;

    const product = await ProductService.updateProduct(req.params.id, {
      name,
      description,
      category,
      costPrice,
      sellingPrice,
      reorderLevel,
      unit,
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const result = await ProductService.deleteProduct(req.params.id);
    if (!result.found) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, message: `Product ${result.sku} deleted successfully` });
  } catch (err) {
    if (err.message?.includes('Cannot delete product with active stock')) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    next(err);
  }
}
