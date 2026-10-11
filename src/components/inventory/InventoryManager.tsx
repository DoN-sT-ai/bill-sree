import React, { useState, useEffect } from 'react';
import { Product, Category } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import {
  Boxes,
  Plus,
  ArrowDownToLine,
  SlidersHorizontal,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit2,
  Barcode,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { CameraScannerModal } from '../billing/CameraScannerModal';

export const InventoryManager: React.FC = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [gstFilter, setGstFilter] = useState<string>('all');

  // Modals state
  const [receiveModalProduct, setReceiveModalProduct] = useState<Product | null>(null);
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [productEditModal, setProductEditModal] = useState<Product | null | 'new'>(null);
  const [scannerTarget, setScannerTarget] = useState<'search' | 'productForm' | null>(null);

  // Form states for modals
  const [receiveQty, setReceiveQty] = useState<string>('10');
  const [receiveReason, setReceiveReason] = useState<string>('Supplier delivery restock');
  const [receivePurchasePrice, setReceivePurchasePrice] = useState<string>('0');
  const [receiveTaxRate, setReceiveTaxRate] = useState<string>('5');
  const [receiveTaxType, setReceiveTaxType] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [receiveSupplierInvoice, setReceiveSupplierInvoice] = useState<string>('');
  const [receiveSupplierGstin, setReceiveSupplierGstin] = useState<string>('');

  const [adjustQty, setAdjustQty] = useState<string>('-1');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT' | 'DAMAGE'>('DAMAGE');

  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Product Form State (Add / Edit)
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    categoryId: '',
    description: '',
    purchasePrice: 0,
    purchaseTaxType: 'EXCLUSIVE' as 'EXCLUSIVE' | 'INCLUSIVE',
    sellingPrice: 0,
    taxRate: 5,
    taxType: 'EXCLUSIVE' as 'EXCLUSIVE' | 'INCLUSIVE',
    currentStock: 0,
    minimumStock: 5,
    unit: 'piece',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [pRes, cRes] = await Promise.all([
        api.getProducts({ activeOnly: false }),
        api.getCategories(),
      ]);
      setProducts(pRes);
      setCategories(cRes);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to load catalog' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
    if (stockFilter === 'low' && (p.current_stock > p.minimum_stock || p.current_stock <= 0)) return false;
    if (stockFilter === 'out' && p.current_stock > 0) return false;
    if (gstFilter !== 'all' && Number(p.tax_rate) !== Number(gstFilter)) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      (p.hsn_code && p.hsn_code.toLowerCase().includes(q))
    );
  });

  // Action: Open Receive Stock modal with full tax details
  const openReceiveModal = (p: Product) => {
    setReceiveModalProduct(p);
    setReceiveQty('10');
    setReceiveReason('Delivery from supplier');
    setReceivePurchasePrice(String(p.purchase_price));
    setReceiveTaxRate(String(p.tax_rate));
    setReceiveTaxType(p.purchase_tax_type || 'EXCLUSIVE');
    setReceiveSupplierInvoice('');
    setReceiveSupplierGstin('');
  };

  // Action: Receive Stock
  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalProduct) return;
    const q = parseFloat(receiveQty);
    if (isNaN(q) || q <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid positive quantity' });
      return;
    }

    try {
      setModalSubmitting(true);
      await api.receiveStock({
        productId: receiveModalProduct.id,
        quantity: q,
        reason: receiveReason.trim(),
        purchasePrice: parseFloat(receivePurchasePrice) || 0,
        taxRate: parseFloat(receiveTaxRate) || 0,
        taxType: receiveTaxType,
        supplierInvoice: receiveSupplierInvoice.trim() || undefined,
        supplierGstin: receiveSupplierGstin.trim() ? receiveSupplierGstin.trim().toUpperCase() : undefined,
      });
      setFeedbackMsg({ type: 'success', text: `Added ${q} units to ${receiveModalProduct.name} with GST breakdown recorded` });
      setReceiveModalProduct(null);
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to receive stock' });
    } finally {
      setModalSubmitting(false);
    }
  };

  // Action: Adjust Stock
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalProduct) return;
    const q = parseFloat(adjustQty);
    if (isNaN(q) || q === 0) {
      setFeedbackMsg({ type: 'error', text: 'Adjustment difference cannot be zero' });
      return;
    }
    if (!adjustReason.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Adjustment reason is mandatory for audit records' });
      return;
    }

    try {
      setModalSubmitting(true);
      await api.adjustStock({
        productId: adjustModalProduct.id,
        quantityDifference: q,
        reason: adjustReason.trim(),
        type: adjustType,
      });
      setFeedbackMsg({ type: 'success', text: `Adjusted ${q} units for ${adjustModalProduct.name}` });
      setAdjustModalProduct(null);
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to adjust stock' });
    } finally {
      setModalSubmitting(false);
    }
  };

  // Action: Save Product (Create or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalSubmitting(true);
      if (productEditModal === 'new') {
        await api.createProduct(productForm);
        setFeedbackMsg({ type: 'success', text: `Product "${productForm.name}" created` });
      } else if (productEditModal) {
        await api.updateProduct(productEditModal.id, productForm);
        setFeedbackMsg({ type: 'success', text: `Product "${productForm.name}" updated` });
      }
      setProductEditModal(null);
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save product' });
    } finally {
      setModalSubmitting(false);
    }
  };

  // Action: Toggle Active
  const handleToggleActive = async (product: Product) => {
    try {
      const willActivate = !product.active;
      await api.toggleProductActive(product.id, willActivate);
      setFeedbackMsg({
        type: 'success',
        text: `Product ${product.name} ${willActivate ? 'activated' : 'deactivated'}`,
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Operation failed' });
    }
  };

  const openNewProductModal = () => {
    setProductForm({
      name: '',
      sku: '',
      barcode: '',
      hsnCode: '',
      categoryId: categories[0]?.id || '',
      description: '',
      purchasePrice: 0,
      purchaseTaxType: 'EXCLUSIVE',
      sellingPrice: 0,
      taxRate: 0,
      taxType: 'EXCLUSIVE',
      currentStock: 0,
      minimumStock: 0,
      unit: 'piece',
    });
    setProductEditModal('new');
  };

  const openEditModal = (p: Product) => {
    setProductForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      hsnCode: p.hsn_code || '',
      categoryId: p.category_id || '',
      description: p.description || '',
      purchasePrice: p.purchase_price,
      purchaseTaxType: p.purchase_tax_type || 'EXCLUSIVE',
      sellingPrice: p.selling_price,
      taxRate: p.tax_rate,
      taxType: p.tax_type || 'EXCLUSIVE',
      currentStock: p.current_stock,
      minimumStock: p.minimum_stock,
      unit: p.unit,
    });
    setProductEditModal(p);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-neutral-50 overflow-y-auto md:overflow-hidden">
      {/* Top Header & Actions */}
      <div className="p-4 bg-white border-b border-neutral-200 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-neutral-900 leading-none">
              Inventory & Catalog
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Track on-hand stock, receive deliveries, and log damage adjustments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
              title="Refresh catalog"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={openNewProductModal}
              className="px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 bg-neutral-50 border border-neutral-200 rounded text-xs focus:bg-white focus:outline-none focus:border-neutral-900"
            />
            <button
              type="button"
              onClick={() => setScannerTarget('search')}
              className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-800 transition-colors"
              title="Scan barcode with camera to search"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          </div>

          {/* Stock filter pills */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded border border-neutral-200">
            <span className="text-neutral-500 text-[10px] uppercase font-mono px-1">Alerts:</span>
            {[
              { id: 'all', label: 'All Items' },
              { id: 'low', label: 'Low Stock' },
              { id: 'out', label: 'Out of Stock' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStockFilter(f.id as any)}
                className={`px-2 py-0.5 rounded transition-colors text-xs font-medium ${
                  stockFilter === f.id
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* GST Slab Filter Dropdown */}
          <select
            value={gstFilter}
            onChange={(e) => setGstFilter(e.target.value)}
            className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs text-neutral-700 focus:outline-none"
            title="Filter by GST Slab"
          >
            <option value="all">All GST Slabs</option>
            <option value="0">0% Exempt</option>
            <option value="3">3% GST</option>
            <option value="5">5% GST</option>
            <option value="12">12% GST</option>
            <option value="18">18% GST</option>
            <option value="28">28% GST</option>
          </select>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs text-neutral-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {feedbackMsg && (
        <div
          className={`mx-4 mt-3 p-2.5 rounded text-xs flex justify-between items-center ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Product List Table */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-400">Loading catalog data...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded border border-neutral-200 p-8 text-center text-xs text-neutral-500">
            No products found matching current criteria.
          </div>
        ) : (
          <div className="bg-white rounded border border-neutral-200 shadow-xs overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">SKU / Barcode</th>
                  <th className="py-2.5 px-3 text-right">Cost Price</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-center">GST Slab / HSN</th>
                  <th className="py-2.5 px-3 text-right">Stock</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.current_stock <= 0;
                  const isLowStock = p.current_stock <= p.minimum_stock && !isOutOfStock;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-neutral-50 transition-colors ${
                        !p.active ? 'opacity-50 bg-neutral-50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-neutral-900">{p.name}</div>
                        <div className="text-[10px] text-neutral-400">{p.unit}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-600">
                        <div>{p.sku}</div>
                        <div className="text-[10px] text-neutral-400">{p.barcode}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-500">
                        <div>{formatCurrency(p.purchase_price)}</div>
                        <div className="text-[9px] text-neutral-400">
                          {p.purchase_tax_type === 'INCLUSIVE' ? 'Incl. GST' : 'Excl. GST'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-mono font-bold tabular-nums text-neutral-900">
                          {formatCurrency(p.selling_price)}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {p.tax_type === 'INCLUSIVE' ? 'Incl. GST' : 'Excl. GST'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                          p.tax_rate === 0
                            ? 'bg-neutral-100 text-neutral-600'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {p.tax_rate === 0 ? '0% Exempt' : `${p.tax_rate}% GST`}
                        </span>
                        <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          {p.hsn_code ? `HSN: ${p.hsn_code}` : 'No HSN'}
                        </div>
                        {p.tax_rate > 0 && (
                          <div className="text-[9px] text-neutral-400 font-mono">
                            Tax: {formatCurrency(
                              p.tax_type === 'INCLUSIVE'
                                ? p.selling_price - p.selling_price / (1 + p.tax_rate / 100)
                                : p.selling_price * (p.tax_rate / 100)
                            )}/unit
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-mono font-bold text-sm text-neutral-900 tabular-nums">
                          {p.current_stock}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Min: {p.minimum_stock}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!p.active ? (
                          <span className="text-[10px] text-neutral-400 font-medium">Inactive</span>
                        ) : isOutOfStock ? (
                          <span className="text-[10px] text-red-600 font-semibold px-1.5 py-0.5 rounded bg-red-50 border border-red-200">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] text-amber-700 font-medium px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-medium px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5">
                        {/* Quick Receive Stock */}
                        <button
                          onClick={() => openReceiveModal(p)}
                          className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                          title="Receive new delivery into stock with GST tax details"
                        >
                          <ArrowDownToLine className="w-3 h-3" />
                          Receive
                        </button>

                        {/* Adjust Stock */}
                        <button
                          onClick={() => {
                            setAdjustModalProduct(p);
                            setAdjustQty('-1');
                            setAdjustReason('');
                            setAdjustType('DAMAGE');
                          }}
                          className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                          title="Record damage or stock adjustment with reason"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          Adjust
                        </button>

                        {/* Admin Edit */}
                        {isAdmin && (
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors inline-flex"
                            title="Edit product info"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Receive Stock with GST Tax Details */}
      {receiveModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <form onSubmit={handleReceiveStock} className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-5 space-y-3.5 my-6 max-h-[85dvh] overflow-y-auto">
            <div>
              <h3 className="font-semibold text-sm text-neutral-900">Receive Stock from Supplier (Purchase Entry)</h3>
              <p className="text-xs text-neutral-600 font-medium mt-0.5">{receiveModalProduct.name}</p>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                Current Stock: {receiveModalProduct.current_stock} {receiveModalProduct.unit} {receiveModalProduct.hsn_code ? `· HSN: ${receiveModalProduct.hsn_code}` : ''}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-neutral-700 block mb-1">
                    Quantity Received *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:border-neutral-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-700 block mb-1">
                    Unit Purchase Cost (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={receivePurchasePrice}
                    onChange={(e) => setReceivePurchasePrice(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Purchase GST Tax Details */}
              <div className="p-3 bg-neutral-50 rounded border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800 text-[11px] uppercase tracking-wider font-mono">
                    Purchase GST Tax Details
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-neutral-500 font-medium">Cost is:</span>
                    <button
                      type="button"
                      onClick={() => setReceiveTaxType('EXCLUSIVE')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        receiveTaxType === 'EXCLUSIVE'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                    >
                      Excl. GST (+ Tax)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiveTaxType('INCLUSIVE')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        receiveTaxType === 'INCLUSIVE'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                    >
                      Incl. GST (With Tax)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-neutral-600 block mb-0.5">
                      Purchase GST Slab
                    </label>
                    <select
                      value={receiveTaxRate}
                      onChange={(e) => setReceiveTaxRate(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-neutral-300 rounded font-medium focus:border-neutral-900 focus:outline-none"
                    >
                      <option value="0">0% - Nil / Exempt</option>
                      <option value="3">3% GST (1.5% + 1.5%)</option>
                      <option value="5">5% GST (2.5% + 2.5%)</option>
                      <option value="12">12% GST (6% + 6%)</option>
                      <option value="18">18% GST (9% + 9%)</option>
                      <option value="28">28% GST (14% + 14%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-neutral-600 block mb-0.5">
                      HSN / SAC Code
                    </label>
                    <div className="text-xs font-mono py-1 px-2 bg-white border border-neutral-200 rounded text-neutral-700">
                      {receiveModalProduct.hsn_code || '1006'}
                    </div>
                  </div>
                </div>

                {/* Live Real-Time GST Breakdown Card */}
                {(() => {
                  const q = parseFloat(receiveQty) || 0;
                  const unitC = parseFloat(receivePurchasePrice) || 0;
                  const tr = parseFloat(receiveTaxRate) || 0;
                  const totalRaw = q * unitC;
                  let baseTaxable = totalRaw;
                  let taxAmt = 0;
                  let totalWithTax = totalRaw;

                  if (receiveTaxType === 'INCLUSIVE' && tr > 0) {
                    baseTaxable = Math.round((totalRaw / (1 + tr / 100)) * 100) / 100;
                    taxAmt = Math.round((totalRaw - baseTaxable) * 100) / 100;
                    totalWithTax = totalRaw;
                  } else {
                    baseTaxable = totalRaw;
                    taxAmt = Math.round((baseTaxable * (tr / 100)) * 100) / 100;
                    totalWithTax = Math.round((baseTaxable + taxAmt) * 100) / 100;
                  }

                  const cgst = Math.round((taxAmt / 2) * 100) / 100;
                  const sgst = Math.round((taxAmt - cgst) * 100) / 100;

                  return (
                    <div className="bg-white p-2.5 rounded border border-neutral-200 text-[11px] space-y-1 font-mono">
                      <div className="flex justify-between text-neutral-600">
                        <span>Taxable Purchase Value:</span>
                        <span className="font-semibold text-neutral-900">{formatCurrency(baseTaxable)}</span>
                      </div>
                      {taxAmt > 0 && (
                        <>
                          <div className="flex justify-between text-neutral-500 text-[10px]">
                            <span>CGST ({(tr / 2).toFixed(1)}%):</span>
                            <span>+{formatCurrency(cgst)}</span>
                          </div>
                          <div className="flex justify-between text-neutral-500 text-[10px]">
                            <span>SGST ({(tr / 2).toFixed(1)}%):</span>
                            <span>+{formatCurrency(sgst)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-800 font-medium">
                            <span>Input Tax Credit (ITC):</span>
                            <span className="font-bold">+{formatCurrency(taxAmt)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-neutral-900 font-bold pt-1 border-t border-neutral-100 text-xs">
                        <span>Total Invoice Amount (incl. Tax):</span>
                        <span className="text-emerald-900 font-bold">{formatCurrency(totalWithTax)}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-medium text-neutral-600 block mb-0.5">
                      Supplier Invoice / DC #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SUP-INV-2041"
                      value={receiveSupplierInvoice}
                      onChange={(e) => setReceiveSupplierInvoice(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-neutral-300 rounded font-mono focus:border-neutral-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-neutral-600 block mb-0.5">
                      Supplier GSTIN
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      value={receiveSupplierGstin}
                      onChange={(e) => setReceiveSupplierGstin(e.target.value.toUpperCase())}
                      className="w-full px-2 py-1 text-xs border border-neutral-300 rounded uppercase font-mono focus:border-neutral-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-neutral-700 block mb-1">
                  Delivery Reason / PO Notes:
                </label>
                <input
                  type="text"
                  value={receiveReason}
                  onChange={(e) => setReceiveReason(e.target.value)}
                  placeholder="e.g. Weekly supplier delivery, batch #10"
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setReceiveModalProduct(null)}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalSubmitting}
                className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
              >
                {modalSubmitting ? 'Receiving...' : 'Add to Stock & Record GST'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 2: Adjust Stock */}
      {adjustModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <form onSubmit={handleAdjustStock} className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-sm w-full p-5 space-y-4 max-h-[85dvh] overflow-y-auto">
            <div>
              <h3 className="font-semibold text-sm text-neutral-900">Adjust Stock (Audit Trail)</h3>
              <p className="text-xs text-neutral-500 mt-0.5 font-medium">{adjustModalProduct.name}</p>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5">Current Stock: {adjustModalProduct.current_stock} {adjustModalProduct.unit}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">
                  Adjustment Type:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('DAMAGE');
                      setAdjustQty('-1');
                    }}
                    className={`p-2 rounded border text-left font-medium ${
                      adjustType === 'DAMAGE' ? 'border-neutral-900 bg-neutral-50 font-bold' : 'border-neutral-200'
                    }`}
                  >
                    Damage / Spoilage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('ADJUSTMENT');
                      setAdjustQty('1');
                    }}
                    className={`p-2 rounded border text-left font-medium ${
                      adjustType === 'ADJUSTMENT' ? 'border-neutral-900 bg-neutral-50 font-bold' : 'border-neutral-200'
                    }`}
                  >
                    Inventory Count Correction
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">
                  Quantity Difference (use negative for deduction, positive for addition):
                </label>
                <input
                  type="number"
                  step="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded font-mono focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">
                  Reason <span className="text-red-500">*</span>:
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Broken bottle during restocking, audit variance count..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                  className="w-full p-2 text-xs border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalSubmitting || !adjustReason.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {modalSubmitting ? 'Recording...' : 'Record Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 3: Add / Edit Product */}
      {productEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <form onSubmit={handleSaveProduct} className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4 my-8 max-h-[85dvh] overflow-y-auto">
            <h3 className="font-semibold text-sm text-neutral-900">
              {productEditModal === 'new' ? 'Create New Product' : 'Edit Product'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-neutral-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Amul Butter 500g"
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-neutral-700 block mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-neutral-700">Barcode *</label>
                    <button
                      type="button"
                      onClick={() => setScannerTarget('productForm')}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                      title="Scan barcode with camera"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Scan with Camera</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                    placeholder="e.g. 8901030383921"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-neutral-700 block mb-1">Category</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-neutral-700 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    placeholder="piece, kg, pack"
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-neutral-700">Purchase Cost (₹)</label>
                    <span className="text-[10px] text-neutral-500">Buying</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={productForm.purchasePrice}
                    onChange={(e) => setProductForm({ ...productForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  />
                  <div className="flex items-center gap-1 mt-1 text-[10px]">
                    <span className="text-neutral-500">Cost:</span>
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, purchaseTaxType: 'EXCLUSIVE' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        productForm.purchaseTaxType === 'EXCLUSIVE'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                    >
                      Excl. Tax
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, purchaseTaxType: 'INCLUSIVE' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        productForm.purchaseTaxType === 'INCLUSIVE'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                    >
                      Incl. Tax
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-neutral-700">Selling Price (₹) *</label>
                    <span className="text-[10px] text-neutral-500">Store Price</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={productForm.sellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  />
                  <div className="flex items-center gap-1 mt-1 text-[10px]">
                    <span className="text-neutral-500">Selling:</span>
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, taxType: 'INCLUSIVE' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        productForm.taxType === 'INCLUSIVE'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                      title="Selling price already includes tax"
                    >
                      With Tax (MRP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, taxType: 'EXCLUSIVE' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        productForm.taxType === 'EXCLUSIVE'
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200'
                      }`}
                      title="Tax is added on top of selling price"
                    >
                      Without Tax (+GST)
                    </button>
                  </div>
                </div>
              </div>

              {/* GST Tax and Pricing Options */}
              <div className="p-3 bg-neutral-50 rounded border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800 text-xs">GST Slab & HSN Classification</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    Mode: {productForm.taxType === 'INCLUSIVE' ? 'Tax Inclusive (MRP)' : 'Tax Exclusive (+GST)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-neutral-700 block mb-1">GST Tax Slab *</label>
                    <select
                      value={productForm.taxRate}
                      onChange={(e) => setProductForm({ ...productForm, taxRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-neutral-300 rounded font-medium focus:border-neutral-900 focus:outline-none"
                    >
                      <option value="0">0% - Nil / Exempt</option>
                      <option value="3">3% GST (1.5% CGST + 1.5% SGST)</option>
                      <option value="5">5% GST (2.5% CGST + 2.5% SGST)</option>
                      <option value="12">12% GST (6% CGST + 6% SGST)</option>
                      <option value="18">18% GST (9% CGST + 9% SGST)</option>
                      <option value="28">28% GST (14% CGST + 14% SGST)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-neutral-700 block mb-1">HSN / SAC Code</label>
                    <input
                      type="text"
                      value={productForm.hsnCode}
                      onChange={(e) => setProductForm({ ...productForm, hsnCode: e.target.value })}
                      placeholder="e.g. 1006, 0401, 8471"
                      className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Common HSN quick presets */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="text-neutral-500">Common HSN:</span>
                  {[
                    { code: '1006', label: '1006 (Rice)' },
                    { code: '0401', label: '0401 (Dairy)' },
                    { code: '1905', label: '1905 (Bakery)' },
                    { code: '8471', label: '8471 (Electronics)' },
                    { code: '6109', label: '6109 (Apparel)' },
                  ].map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => setProductForm({ ...productForm, hsnCode: preset.code })}
                      className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-neutral-600 hover:text-neutral-900 hover:border-neutral-400 font-mono cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Live GST Calculation Preview Card */}
                {(() => {
                  const sp = Number(productForm.sellingPrice) || 0;
                  const cp = Number(productForm.purchasePrice) || 0;
                  const tr = Number(productForm.taxRate) || 0;
                  let baseTaxable = sp;
                  let taxAmt = 0;
                  let finalCustPrice = sp;

                  if (productForm.taxType === 'INCLUSIVE' && tr > 0) {
                    finalCustPrice = sp;
                    baseTaxable = Math.round((sp / (1 + tr / 100)) * 100) / 100;
                    taxAmt = Math.round((sp - baseTaxable) * 100) / 100;
                  } else {
                    baseTaxable = sp;
                    taxAmt = Math.round((sp * (tr / 100)) * 100) / 100;
                    finalCustPrice = Math.round((sp + taxAmt) * 100) / 100;
                  }

                  const cgstAmt = Math.round((taxAmt / 2) * 100) / 100;
                  const sgstAmt = Math.round((taxAmt - cgstAmt) * 100) / 100;

                  // Purchase base
                  let purchaseTaxable = cp;
                  let purchaseTaxAmt = 0;
                  if (productForm.purchaseTaxType === 'INCLUSIVE' && tr > 0) {
                    purchaseTaxable = Math.round((cp / (1 + tr / 100)) * 100) / 100;
                    purchaseTaxAmt = Math.round((cp - purchaseTaxable) * 100) / 100;
                  } else {
                    purchaseTaxAmt = Math.round((cp * (tr / 100)) * 100) / 100;
                  }

                  const marginAmt = Math.round((baseTaxable - purchaseTaxable) * 100) / 100;
                  const marginPct = purchaseTaxable > 0 ? Math.round((marginAmt / purchaseTaxable) * 100) : 0;

                  return (
                    <div className="bg-white p-2.5 rounded border border-neutral-200 text-[11px] space-y-1">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                        Live GST Calculation Preview
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-neutral-600 font-mono">
                        <div>Taxable Base: <span className="font-semibold text-neutral-900">{formatCurrency(baseTaxable)}</span></div>
                        <div>CGST ({(tr / 2).toFixed(1)}%): <span className="font-semibold text-neutral-900">{formatCurrency(cgstAmt)}</span></div>
                        <div>SGST ({(tr / 2).toFixed(1)}%): <span className="font-semibold text-neutral-900">{formatCurrency(sgstAmt)}</span></div>
                        <div>Output GST: <span className="font-bold text-emerald-800">{formatCurrency(taxAmt)}</span></div>
                      </div>
                      <div className="flex justify-between items-baseline pt-1 border-t border-neutral-100 font-medium">
                        <span className="text-neutral-700">Customer Final Bill Price:</span>
                        <span className="font-mono font-bold text-xs text-neutral-900">
                          {formatCurrency(finalCustPrice)}
                          <span className="text-[10px] font-normal text-neutral-500 ml-1">
                            ({productForm.taxType === 'INCLUSIVE' ? 'With Tax' : 'Without Tax + GST'})
                          </span>
                        </span>
                      </div>
                      {cp > 0 && (
                        <div className="text-[10px] text-neutral-500 font-mono pt-0.5 border-t border-neutral-100">
                          Est. Gross Margin: {formatCurrency(marginAmt)} ({marginPct}% markup over cost)
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {productEditModal === 'new' && (
                  <div>
                    <label className="font-medium text-neutral-700 block mb-1">Initial Stock</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={productForm.currentStock}
                      onChange={(e) => setProductForm({ ...productForm, currentStock: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="font-medium text-neutral-700 block mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.minimumStock}
                    onChange={(e) => setProductForm({ ...productForm, minimumStock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
              {productEditModal !== 'new' ? (
                <button
                  type="button"
                  onClick={() => handleToggleActive(productEditModal)}
                  className={`text-xs font-medium px-2.5 py-1 rounded ${
                    productEditModal.active
                      ? 'text-red-700 hover:bg-red-50'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {productEditModal.active ? 'Deactivate Product' : 'Activate Product'}
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProductEditModal(null)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors"
                >
                  {modalSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Camera Barcode Scanner Modal for Inventory */}
      {scannerTarget && (
        <CameraScannerModal
          products={products}
          title={scannerTarget === 'search' ? 'Scan Barcode to Find Item' : 'Scan Product Barcode'}
          onBarcodeDetected={(code) => {
            if (scannerTarget === 'search') {
              setSearchQuery(code);
              setScannerTarget(null);
              return { success: true, message: `Searching barcode ${code}` };
            } else {
              setProductForm((prev) => ({ ...prev, barcode: code }));
              setScannerTarget(null);
              return { success: true, message: `Barcode set to ${code}` };
            }
          }}
          onClose={() => setScannerTarget(null)}
        />
      )}
    </div>
  );
};
