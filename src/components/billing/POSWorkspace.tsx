import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, CartItem, Sale } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency, formatBillNumber } from '../../lib/utils';
import { CameraScannerModal } from './CameraScannerModal';
import { findProductByCode, playScannerBeep } from '../../lib/barcodeUtils';
import { useAuth } from '../../context/AuthContext';
import { ThermalReceiptContent } from './ThermalReceiptContent';
import { ReceiptModal } from './ReceiptModal';
import { printReceipt } from '../../lib/printerService';
import {
  Search,
  Barcode,
  Camera,
  Plus,
  Minus,
  Trash2,
  Check,
  CreditCard,
  Banknote,
  QrCode,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  CheckCircle,
  Receipt,
  Printer,
  Eye,
  X,
} from 'lucide-react';

interface POSWorkspaceProps {
  onNavigateToSales?: () => void;
}

export const POSWorkspace: React.FC<POSWorkspaceProps> = ({ onNavigateToSales }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);

  // Mobile navigation between Catalog and Cart
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Employee Selling Tax Mode: With Tax (Inclusive) vs Without Tax (Exclusive) vs AUTO
  const [sellingTaxMode, setSellingTaxMode] = useState<'INCLUSIVE' | 'EXCLUSIVE' | 'AUTO'>('INCLUSIVE');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'OTHER'>('UPI');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>('');

  const { store } = useAuth();

  // GST & Customer Details
  const [gstType, setGstType] = useState<'INTRA_STATE' | 'INTER_STATE' | 'EXEMPT'>('INTRA_STATE');
  const [showCustomerDetails, setShowCustomerDetails] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerGstin, setCustomerGstin] = useState<string>('');

  // Submission, Auto-Print & Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedSaleForPrint, setCompletedSaleForPrint] = useState<Sale | null>(null);
  const [activeModalSale, setActiveModalSale] = useState<Sale | null>(null);
  const [autoPrintQr, setAutoPrintQr] = useState<string>('');
  const [lastCompletedBill, setLastCompletedBill] = useState<{
    billNumber: string;
    total: number;
    paymentMethod: string;
  } | null>(null);

  // Auto-Print Toggle (persisted in localStorage)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pos_auto_print') === 'true';
  });
  const [showAllCatalog, setShowAllCatalog] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;
  const cartRef = useRef<CartItem[]>([]);
  cartRef.current = cart;

  const toggleAutoPrint = () => {
    setAutoPrintEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('pos_auto_print', String(next));
      return next;
    });
  };

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.getProducts({ activeOnly: true }),
        api.getCategories(),
      ]);
      setProducts(prodRes);
      setCategories(catRes);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // O(1) Cart product lookup map
  const cartMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.product.id, item.quantity);
    }
    return map;
  }, [cart]);

  // Precomputed category product counts (O(N) once rather than O(C * N) per render)
  const categoryCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.category_id) {
        counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
      }
    }
    return counts;
  }, [products]);

  // Memoized Filtered Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, searchQuery]);

  // Visible products in DOM — capped to 60 for initial load for instantaneous rendering
  const visibleProducts = useMemo(() => {
    if (searchQuery || selectedCategory !== 'all' || showAllCatalog) {
      return filteredProducts;
    }
    return filteredProducts.slice(0, 60);
  }, [filteredProducts, searchQuery, selectedCategory, showAllCatalog]);

  // Add product to cart
  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.current_stock <= 0) {
      setErrorMessage(`"${product.name}" is currently out of stock.`);
      return;
    }

    setErrorMessage(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantityToAdd;
        if (newQty > product.current_stock) {
          setErrorMessage(`Only ${product.current_stock} items available in stock for "${product.name}".`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      } else {
        if (quantityToAdd > product.current_stock) {
          setErrorMessage(`Only ${product.current_stock} items available in stock for "${product.name}".`);
          return prev;
        }
        return [...prev, { product, quantity: quantityToAdd }];
      }
    });
  };

  // Modify quantity
  const updateQuantity = (productId: string, newQty: number) => {
    setErrorMessage(null);
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (newQty > item.product.current_stock) {
            setErrorMessage(`Stock limit reached! Only ${item.product.current_stock} available.`);
            return { ...item, quantity: item.product.current_stock };
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerNotes('');
    setCashTendered('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerGstin('');
    setGstType('INTRA_STATE');
    setShowCustomerDetails(false);
    setErrorMessage(null);
    setMobileTab('catalog');
  };

  const toggleItemTaxMode = (productId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const currentMode =
            item.taxTypeOverride ||
            (sellingTaxMode !== 'AUTO' ? sellingTaxMode : item.product.tax_type) ||
            'EXCLUSIVE';
          const nextMode: 'INCLUSIVE' | 'EXCLUSIVE' =
            currentMode === 'INCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
          return { ...item, taxTypeOverride: nextMode };
        }
        return item;
      })
    );
  };

  // Unified Barcode Processor (used by keyboard, USB laser scanner, and camera)
  const handleBarcodeProcess = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return { success: false, message: 'Empty barcode' };

    const matched = findProductByCode(products, code);

    if (matched) {
      if (matched.current_stock <= 0) {
        setErrorMessage(`"${matched.name}" is currently out of stock.`);
        playScannerBeep('error');
        return { success: false, message: `${matched.name} is out of stock`, product: matched };
      }
      addToCart(matched, 1);
      setBarcodeInput('');
      playScannerBeep('success');
      return { success: true, message: `Added ${matched.name} to bill`, product: matched };
    } else {
      setErrorMessage(`No product found with barcode or SKU: "${code}"`);
      playScannerBeep('error');
      return { success: false, message: `No product matching ${code}` };
    }
  };

  // Handle direct Barcode submission (USB scanner / keyboard enter in input)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleBarcodeProcess(barcodeInput);
  };

  // Handle detection from camera scanner
  const handleCameraBarcodeDetect = (code: string) => {
    return handleBarcodeProcess(code);
  };

  // Global Hardware Barcode Scanner Listener
  // Catches rapid keystrokes from USB / Bluetooth laser scanners from anywhere on screen
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter: Quick complete bill keyboard shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cartRef.current.length > 0) {
          handleCompleteBill();
        }
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isBarcodeInput = target === barcodeInputRef.current;

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const isFastScan = buffer.length >= 3 && timeDiff < 90;
        if (isFastScan || isBarcodeInput) {
          if (buffer.trim()) {
            e.preventDefault();
            const scannedCode = buffer.trim();
            buffer = '';
            handleBarcodeProcess(scannedCode);
            barcodeInputRef.current?.focus();
            return;
          }
        }
        buffer = '';
        return;
      }

      // Collect single printable character
      if (e.key.length === 1) {
        if (timeDiff > 100 && !isBarcodeInput) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Client calculations for real-time display taking into account sellingTaxMode and gstType
  let calculatedSubtotal = 0;
  let calculatedTax = 0;

  cart.forEach((item) => {
    const qty = item.quantity;
    const sp = item.product.selling_price;
    const tr = gstType === 'EXEMPT' ? 0 : (item.product.tax_rate || 0);

    const effectiveTaxMode =
      item.taxTypeOverride ||
      (sellingTaxMode !== 'AUTO' ? sellingTaxMode : item.product.tax_type) ||
      'EXCLUSIVE';

    if (effectiveTaxMode === 'INCLUSIVE' && tr > 0) {
      // Selling price already includes tax (With Tax / MRP)
      const lineTotal = qty * sp;
      const base = lineTotal / (1 + tr / 100);
      const tax = lineTotal - base;
      calculatedSubtotal += base;
      calculatedTax += tax;
    } else {
      // Selling price is without tax (tax added on top)
      const base = qty * sp;
      const tax = base * (tr / 100);
      calculatedSubtotal += base;
      calculatedTax += tax;
    }
  });

  const subtotal = Math.round(calculatedSubtotal * 100) / 100;
  const estimatedTax = Math.round(calculatedTax * 100) / 100;

  const cgst = gstType === 'INTRA_STATE' ? Math.round((estimatedTax / 2) * 100) / 100 : 0;
  const sgst = gstType === 'INTRA_STATE' ? Math.round((estimatedTax - cgst) * 100) / 100 : 0;
  const igst = gstType === 'INTER_STATE' ? estimatedTax : 0;

  const rawPayable = subtotal + estimatedTax - discount;
  const totalPayable = Math.max(0, Math.round(rawPayable));
  const roundOff = Math.round((totalPayable - rawPayable) * 100) / 100;

  // Cash change calculation
  const cashNum = parseFloat(cashTendered) || 0;
  const changeDue = cashNum >= totalPayable ? cashNum - totalPayable : 0;

  // Auto-Print bill using connected printer (Free-size automatically fits 80mm roll or full-page A4)
  const triggerAutoPrint = (saleToPrint: Sale) => {
    printReceipt({
      sale: saleToPrint,
      store,
      format: 'free',
      docType: 'BILL',
      qrCodeDataUrl: autoPrintQr,
    });
  };

  // Complete Bill Action — optimized for sub-second checkout
  const handleCompleteBill = async () => {
    if (cart.length === 0) {
      setErrorMessage('Please add at least one item to the cart.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const currentCart = [...cart];
      const payload = {
        items: currentCart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          taxType:
            item.taxTypeOverride ||
            (sellingTaxMode !== 'AUTO' ? sellingTaxMode : item.product.tax_type) ||
            'EXCLUSIVE',
        })),
        discount: Number(discount) || 0,
        paymentMethod,
        notes: customerNotes || undefined,
        gstType,
        taxMode: sellingTaxMode,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerGstin: customerGstin.trim() ? customerGstin.trim().toUpperCase() : undefined,
      };

      const sale = await api.createSale(payload);

      // Instant UI update: deduct stock locally in memory (0ms network delay)
      setProducts((prev) =>
        prev.map((p) => {
          const match = currentCart.find((i) => i.product.id === p.id);
          if (match) {
            return { ...p, current_stock: Math.max(0, p.current_stock - match.quantity) };
          }
          return p;
        })
      );

      // Save sale for printing & confirmation banner
      setCompletedSaleForPrint(sale);
      setLastCompletedBill({
        billNumber: sale.bill_number,
        total: sale.total,
        paymentMethod: sale.payment_method,
      });

      // Reset checkout form immediately
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerNotes('');
      setCashTendered('');
      setDiscount(0);
      setMobileTab('catalog');

      // Generate verification QR code non-blockingly
      const publicVerificationUrl = `${window.location.origin}/?verify=${sale.verification_token}`;
      api.getQRCode(publicVerificationUrl)
        .then(res => setAutoPrintQr(res.dataUrl))
        .catch(() => {});

      // Non-blocking print trigger if auto-print enabled
      if (autoPrintEnabled) {
        setTimeout(() => triggerAutoPrint(sale), 50);
      }

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      setErrorMessage(err.message || 'Bill creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-neutral-100 overflow-hidden">
      {/* Instant Confirmation Banner on Billing Completion (With Auto-Print Feedback) */}
      {lastCompletedBill && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 flex flex-wrap items-center justify-between text-xs shadow-sm shrink-0 gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-200" />
            <span>
              <strong>Bill #{formatBillNumber(lastCompletedBill.billNumber, 'BILL')}</strong> completed & sent to printer! Total:{' '}
              <span className="font-bold font-mono">{formatCurrency(lastCompletedBill.total)}</span> ({lastCompletedBill.paymentMethod})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {completedSaleForPrint && (
              <button
                type="button"
                onClick={() => triggerAutoPrint(completedSaleForPrint)}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold text-[11px] transition cursor-pointer flex items-center gap-1 border border-emerald-500 shadow-xs"
                title="Print 3-inch thermal bill again"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Again (3")</span>
              </button>
            )}
            {completedSaleForPrint && (
              <button
                type="button"
                onClick={() => setActiveModalSale(completedSaleForPrint)}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold text-[11px] transition cursor-pointer flex items-center gap-1 border border-emerald-500 shadow-xs"
                title="View bill, download full-page PDF, or share WhatsApp"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View / PDF</span>
              </button>
            )}
            {onNavigateToSales && (
              <button
                type="button"
                onClick={onNavigateToSales}
                className="px-2.5 py-1 bg-white text-emerald-800 rounded font-semibold text-[11px] hover:bg-emerald-50 transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Past Records</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setLastCompletedBill(null)}
              className="p-1 hover:bg-emerald-700 rounded text-emerald-200 hover:text-white transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Split Layout: Catalog & Cart */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* LEFT SECTION: Product Catalog & Search */}
      <div className={`${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'} flex-1 flex flex-col min-w-0 border-r border-neutral-200 bg-white h-full min-h-0`}>
        {/* Top Control Bar: Search & Barcode */}
        <div className="p-3 border-b border-neutral-200 bg-white space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            {/* Search Input */}
            <div className="relative sm:col-span-5">
              <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:border-neutral-900 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-xs text-neutral-400 hover:text-neutral-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Barcode Scanner Input */}
            <form onSubmit={handleBarcodeSubmit} className="relative flex sm:col-span-4">
              <Barcode className="w-4 h-4 text-neutral-500 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Barcode + Enter"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full pl-8 pr-14 py-1.5 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:border-neutral-900 focus:outline-none"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 px-2 bg-neutral-900 text-white text-[11px] font-medium rounded hover:bg-neutral-800 transition-colors"
              >
                Scan
              </button>
            </form>

            {/* Camera Scanner Trigger Button */}
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="sm:col-span-3 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              title="Open camera to scan barcode"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Camera Scan</span>
            </button>
          </div>

          {/* Category Tabs (Segmented controls) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 pt-1 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => {
              const count = categoryCountMap.get(cat.id) || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-400">Loading catalog...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs">
              No products found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {visibleProducts.map((p) => {
                const cartQty = cartMap.get(p.id) || 0;
                const inCart = cartQty > 0;
                const isOutOfStock = p.current_stock <= 0;
                const isLowStock = p.current_stock <= p.minimum_stock && !isOutOfStock;

                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p, 1)}
                    disabled={isOutOfStock}
                    className={`relative text-left p-3 rounded border text-xs flex flex-col justify-between transition-all group ${
                      isOutOfStock
                        ? 'border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed'
                        : inCart
                        ? 'border-neutral-900 bg-neutral-50/70 shadow-xs'
                        : 'border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-semibold text-neutral-900 line-clamp-2 leading-snug">
                          {p.name}
                        </span>
                        {inCart && (
                          <span className="shrink-0 bg-neutral-900 text-white text-[10px] font-mono px-1.5 py-0.2 rounded">
                            {cartQty} in cart
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5 flex items-center gap-1">
                        <span>{p.sku}</span>
                        {p.hsn_code && <span>· HSN: {p.hsn_code}</span>}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-neutral-100 flex items-end justify-between">
                      <div>
                        <div className="text-sm font-bold text-neutral-900 tabular-nums">
                          {formatCurrency(p.selling_price)}
                        </div>
                        <div className="text-[9px] font-mono text-neutral-500">
                          {p.tax_rate > 0 ? `${p.tax_rate}% GST` : '0% Exempt'}
                        </div>
                      </div>

                      <div className="text-right">
                        {isOutOfStock ? (
                          <span className="text-[10px] font-medium text-red-600">Out of Stock</span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-medium text-amber-600">
                            {p.current_stock} left
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-500">
                            Stock: {p.current_stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length > 60 && !showAllCatalog && !searchQuery && selectedCategory === 'all' && (
                <div className="col-span-full py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllCatalog(true)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded transition cursor-pointer"
                  >
                    Load all remaining products ({filteredProducts.length - 60} more)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile View Cart Bar (Sticky at bottom of Catalog on mobile) */}
        {cart.length > 0 && (
          <div className="lg:hidden p-3 bg-white border-t border-neutral-200 flex items-center justify-between shadow-lg shrink-0">
            <div>
              <div className="text-[11px] text-neutral-500 font-medium">
                {cart.reduce((s, i) => s + i.quantity, 0)} items in bill
              </div>
              <div className="text-base font-bold text-neutral-900 font-mono tabular-nums">
                {formatCurrency(totalPayable)}
              </div>
            </div>
            <button
              onClick={() => setMobileTab('cart')}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span>View Bill & Pay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT SECTION: Cart & Checkout Workspace */}
      <div className={`${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'} w-full lg:w-[380px] xl:w-[420px] bg-white flex flex-col shrink-0 border-t lg:border-t-0 border-neutral-200 shadow-xs h-full min-h-0 overflow-y-auto`}>
        {/* Cart Header */}
        <div className="p-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileTab('catalog')}
              className="lg:hidden p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded transition-colors flex items-center gap-0.5 text-xs font-medium mr-1 cursor-pointer"
              title="Back to Catalog"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Catalog</span>
            </button>
            <ShoppingBag className="w-4 h-4 text-neutral-900" />
            <h2 className="text-xs font-semibold text-neutral-900 uppercase tracking-wide">
              Current Bill ({cart.reduce((sum, i) => sum + i.quantity, 0)} Items)
            </h2>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] text-red-600 hover:text-red-800 font-medium transition-colors cursor-pointer"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Employee Selling Tax Mode Selector */}
        <div className="p-2.5 bg-neutral-50 border-b border-neutral-200 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-neutral-800">Selling Price Tax Mode:</span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {sellingTaxMode === 'INCLUSIVE' ? 'MRP (Tax Included)' : sellingTaxMode === 'EXCLUSIVE' ? 'Base + GST Added' : 'Item Default'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setSellingTaxMode('INCLUSIVE')}
              className={`py-1 px-1 rounded text-center border font-medium transition-colors cursor-pointer ${
                sellingTaxMode === 'INCLUSIVE'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              With Tax (MRP)
            </button>
            <button
              type="button"
              onClick={() => setSellingTaxMode('EXCLUSIVE')}
              className={`py-1 px-1 rounded text-center border font-medium transition-colors cursor-pointer ${
                sellingTaxMode === 'EXCLUSIVE'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              Without Tax (+GST)
            </button>
            <button
              type="button"
              onClick={() => setSellingTaxMode('AUTO')}
              className={`py-1 px-1 rounded text-center border font-medium transition-colors cursor-pointer ${
                sellingTaxMode === 'AUTO'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              Item Default
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-2.5 bg-red-50 border-b border-red-200 text-red-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-xs font-bold text-red-600">✕</button>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-neutral-100 min-h-[200px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <ShoppingBag className="w-8 h-8 mb-2 text-neutral-300" />
              <p className="text-xs font-medium text-neutral-600">Cart is currently empty</p>
              <p className="text-[11px] text-neutral-400 mt-1 max-w-[200px]">
                Click any product on the left or scan a barcode to add to this bill.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemEffectiveTaxMode = item.taxTypeOverride || (sellingTaxMode !== 'AUTO' ? sellingTaxMode : item.product.purchase_tax_type || 'INCLUSIVE');
              const rate = item.product.tax_rate || 0;
              const rawLine = item.quantity * item.product.selling_price;
              const itemTotal = itemEffectiveTaxMode === 'INCLUSIVE' ? rawLine : (rawLine * (1 + rate / 100));

              return (
                <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-neutral-500 font-mono">
                      <span>{formatCurrency(item.product.selling_price)} × {item.quantity} {item.product.unit}</span>
                      <span className="text-neutral-300">·</span>
                      <button
                        type="button"
                        onClick={() => toggleItemTaxMode(item.product.id)}
                        title="Click to toggle selling with tax (inclusive) or without tax (+GST) for this item"
                        className={`px-1.5 py-0.2 rounded border text-[9px] font-semibold cursor-pointer transition-colors ${
                          itemEffectiveTaxMode === 'INCLUSIVE'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {itemEffectiveTaxMode === 'INCLUSIVE' ? 'Incl. Tax' : '+ Tax (Excl.)'}
                      </button>
                      <span className="text-neutral-300">·</span>
                      <span className="text-neutral-600 font-semibold">{rate}% GST</span>
                      {item.product.hsn_code && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span>HSN {item.product.hsn_code}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quantity adjustment buttons */}
                  <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded border border-neutral-200">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-5 h-5 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-white rounded transition-colors"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={item.product.current_stock}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                      className="w-8 text-center text-xs font-bold bg-transparent focus:outline-none tabular-nums"
                    />
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-5 h-5 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-white rounded transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Line Total */}
                  <div className="text-right shrink-0 w-20">
                    <div className="font-semibold text-neutral-900 tabular-nums">
                      {formatCurrency(itemTotal)}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-[10px] text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Calculation & Payment Drawer */}
        <div className="p-3 border-t border-neutral-200 bg-neutral-50 space-y-3">
          {/* GST Billing Mode Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-600">
              <span className="font-medium">GST Billing Mode:</span>
              <button
                type="button"
                onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                className="text-[11px] text-neutral-800 hover:text-neutral-900 underline font-medium"
              >
                {showCustomerDetails ? 'Hide Customer/GSTIN' : '+ Customer / GSTIN (B2B)'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setGstType('INTRA_STATE')}
                className={`py-1 px-1.5 rounded text-center border font-medium transition-colors ${
                  gstType === 'INTRA_STATE'
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                Intra-State (CGST+SGST)
              </button>
              <button
                type="button"
                onClick={() => setGstType('INTER_STATE')}
                className={`py-1 px-1.5 rounded text-center border font-medium transition-colors ${
                  gstType === 'INTER_STATE'
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                Inter-State (IGST)
              </button>
              <button
                type="button"
                onClick={() => setGstType('EXEMPT')}
                className={`py-1 px-1.5 rounded text-center border font-medium transition-colors ${
                  gstType === 'EXEMPT'
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                Exempt (0% GST)
              </button>
            </div>
          </div>

          {/* Customer / B2B GSTIN Collapsible Section */}
          {showCustomerDetails && (
            <div className="p-2.5 bg-white rounded border border-neutral-200 space-y-2 text-xs">
              <div className="font-semibold text-neutral-800 text-[11px] uppercase tracking-wider font-mono">
                B2B Customer & GSTIN Details
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-500 font-medium block mb-0.5">Customer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma / ABC Traders"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 font-medium block mb-0.5">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-mono border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 font-medium block mb-0.5">Customer GSTIN (15 Digits)</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  className="w-full px-2 py-1 text-xs font-mono border border-neutral-300 rounded uppercase focus:border-neutral-900 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Subtotals & Taxes */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Taxable Subtotal</span>
              <span className="tabular-nums font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {gstType === 'EXEMPT' ? (
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>GST Tax</span>
                <span className="font-mono text-emerald-700">0% (Bill of Supply / Exempt)</span>
              </div>
            ) : gstType === 'INTER_STATE' && igst > 0 ? (
              <>
                <div className="flex justify-between text-neutral-500 text-[11px] pl-2 border-l border-neutral-200">
                  <span>IGST (Integrated Tax 100%)</span>
                  <span className="tabular-nums font-mono">+{formatCurrency(igst)}</span>
                </div>
                <div className="flex justify-between text-neutral-700 font-medium">
                  <span>Total GST</span>
                  <span className="tabular-nums font-mono font-semibold">+{formatCurrency(estimatedTax)}</span>
                </div>
              </>
            ) : estimatedTax > 0 ? (
              <>
                <div className="flex justify-between text-neutral-500 text-[11px] pl-2 border-l border-neutral-200">
                  <span>CGST (Central Tax 50%)</span>
                  <span className="tabular-nums font-mono">+{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between text-neutral-500 text-[11px] pl-2 border-l border-neutral-200">
                  <span>SGST (State Tax 50%)</span>
                  <span className="tabular-nums font-mono">+{formatCurrency(sgst)}</span>
                </div>
                <div className="flex justify-between text-neutral-700 font-medium">
                  <span>Total GST</span>
                  <span className="tabular-nums font-mono font-semibold">+{formatCurrency(estimatedTax)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>GST Tax</span>
                <span className="font-mono text-emerald-700">0% (Nil / Exempt)</span>
              </div>
            )}

            {/* Discount field */}
            <div className="flex items-center justify-between text-neutral-600 pt-0.5">
              <span>Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-neutral-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={discount === 0 ? '' : discount}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 px-1.5 py-0.5 text-right text-xs bg-white border border-neutral-300 rounded font-mono tabular-nums focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>

            {/* Round Off */}
            {roundOff !== 0 && (
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>Round Off</span>
                <span className="font-mono tabular-nums">
                  {roundOff > 0 ? `+${formatCurrency(roundOff)}` : formatCurrency(roundOff)}
                </span>
              </div>
            )}

            {/* Grand Total */}
            <div className="flex justify-between items-baseline pt-2 border-t border-neutral-200">
              <span className="font-bold text-neutral-900 text-sm">TOTAL DUE</span>
              <span className="font-bold text-xl text-neutral-900 tabular-nums font-mono">
                {formatCurrency(totalPayable)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <div className="text-[11px] font-medium text-neutral-600 mb-1.5">Payment Method:</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'CARD', label: 'Card', icon: CreditCard },
                { id: 'OTHER', label: 'Other', icon: Check },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-1 rounded flex flex-col items-center justify-center text-center transition-colors border ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-0.5" />
                    <span className="text-[10px] leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Tendered Helper (Shows only if CASH selected) */}
          {paymentMethod === 'CASH' && (
            <div className="p-2 bg-neutral-100 rounded border border-neutral-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 font-medium">Cash Received:</span>
                <input
                  type="number"
                  placeholder={String(Math.ceil(totalPayable))}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-24 px-2 py-0.5 text-right font-mono text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
                />
              </div>
              {cashNum > 0 && (
                <div className="flex justify-between items-center text-neutral-800 pt-1 border-t border-neutral-200">
                  <span className="font-medium">Change to Return:</span>
                  <span className={`font-mono font-bold ${changeDue >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatCurrency(changeDue)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes field */}
          <div>
            <input
              type="text"
              placeholder="Optional notes or customer details..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-white border border-neutral-200 rounded focus:outline-none focus:border-neutral-900"
            />
          </div>

          {/* Auto-Print option & keyboard helper */}
          <div className="flex items-center justify-between px-1 text-[11px] text-neutral-600">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoPrintEnabled}
                onChange={toggleAutoPrint}
                className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer"
              />
              <span>Auto-open print dialog</span>
            </label>
            <span className="text-[10px] text-neutral-400 font-mono">Ctrl+Enter</span>
          </div>

          {/* Action Button: Complete Bill */}
          <button
            onClick={handleCompleteBill}
            disabled={cart.length === 0 || isSubmitting}
            className={`w-full py-3 rounded font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              cart.length === 0 || isSubmitting
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99] shadow-xs cursor-pointer'
            }`}
          >
            {isSubmitting ? (
              <span>Processing Bill...</span>
            ) : (
              <>
                <span>Complete Bill</span>
                <span className="font-mono tabular-nums">({formatCurrency(totalPayable)})</span>
              </>
            )}
          </button>
        </div>
      </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      {showCameraScanner && (
        <CameraScannerModal
          products={products}
          onBarcodeDetected={handleCameraBarcodeDetect}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* Bill Preview Modal when user clicks "View / PDF" */}
      {activeModalSale && (
        <ReceiptModal
          sale={activeModalSale}
          onClose={() => setActiveModalSale(null)}
          onNewBill={() => setActiveModalSale(null)}
          autoPrint={false}
        />
      )}
    </div>
  );
};
