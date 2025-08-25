// ======== Enhanced Persistence & State Management ========
const LS_KEYS = {
  INVENTORY: "inventory_enhanced_v2",
  SALES: "salesHistory_enhanced_v2",
  SETTINGS: "settings_enhanced_v2"
};

let inventory = JSON.parse(localStorage.getItem(LS_KEYS.INVENTORY)) || [];
let salesHistory = JSON.parse(localStorage.getItem(LS_KEYS.SALES)) || [];
let settings = JSON.parse(localStorage.getItem(LS_KEYS.SETTINGS)) || {
  defaultMinStock: 5,
  currency: "INR",
  notifications: true
};

let editIndex = -1;
let currentCategoryFilter = "";
let charts = {};

// ======== DOM Helpers ========
const $ = (id) => document.getElementById(id);
const addUpdateBtn = $("addUpdateBtn");

// ======== Enhanced Utility Functions ========
function round2(n) { 
  return Math.round((+n + Number.EPSILON) * 100) / 100; 
}

function formatINR(n) { 
  return `₹${round2(n).toLocaleString("en-IN")}`; 
}

function applyRounding(value, mode) {
  if (mode === "nearest1") return Math.round(value);
  if (mode === "nearest2") return Math.round(value / 2) * 2;
  return value;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ======== Save / Load Functions ========
function saveAll() {
  localStorage.setItem(LS_KEYS.INVENTORY, JSON.stringify(inventory));
  localStorage.setItem(LS_KEYS.SALES, JSON.stringify(salesHistory));
  localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
}

function backupData() {
  const backup = {
    inventory,
    salesHistory,
    settings,
    timestamp: new Date().toISOString(),
    version: "2.0"
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { 
    type: "application/json" 
  });
  
  downloadBlob(blob, `inventory_backup_${new Date().toISOString().split('T')[0]}.json`);
  showNotification("Backup created successfully!", "success");
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.inventory && data.salesHistory) {
            inventory = data.inventory;
            salesHistory = data.salesHistory;
            settings = { ...settings, ...data.settings };
            saveAll();
            renderAll();
            showNotification("Data imported successfully!", "success");
          } else {
            showNotification("Invalid backup file format!", "error");
          }
        } catch (error) {
          showNotification("Error importing data: " + error.message, "error");
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

// ======== Enhanced Product Management ========
function getStockStatus(item) {
  const minStock = item.minStock || settings.defaultMinStock;
  if (item.qty === 0) {
    return { status: "Out of Stock", class: "out-of-stock", badge: "status-out-of-stock" };
  } else if (item.qty <= minStock) {
    return { status: "Low Stock", class: "low-stock", badge: "status-low-stock" };
  } else if (item.qty <= minStock * 2) {
    return { status: "Medium Stock", class: "medium-stock", badge: "status-medium-stock" };
  } else {
    return { status: "In Stock", class: "", badge: "status-in-stock" };
  }
}

function addOrUpdateProduct(event) {
  if (event) event.preventDefault();
  
  const name = $("name").value.trim();
  const category = $("category").value || "Other";
  const qty = parseInt($("qty").value, 10);
  const unit = $("unit").value || "pieces";
  const price = parseFloat($("price").value);
  const minStock = parseInt($("minStock").value, 10) || settings.defaultMinStock;

  if (!name || isNaN(qty) || isNaN(price)) {
    showNotification("Please fill all required fields correctly!", "error");
    return;
  }

  // Check for duplicate names when adding new product
  if (editIndex === -1) {
    const existingProduct = inventory.find(item => 
      item.name.toLowerCase() === name.toLowerCase()
    );
    if (existingProduct) {
      showNotification("Product with this name already exists!", "error");
      return;
    }
  }

const product = { 
  id: editIndex === -1 ? generateId() : inventory[editIndex].id,
  name, 
  category,
  qty, 
  unit, // Add this line
  price: round2(price),
  minStock,
  createdAt: editIndex === -1 ? new Date().toISOString() : inventory[editIndex].createdAt,
  updatedAt: new Date().toISOString()
};

  if (editIndex === -1) {
    inventory.push(product);
    showNotification(`Product "${name}" added successfully!`, "success");
  } else {
    inventory[editIndex] = product;
    showNotification(`Product "${name}" updated successfully!`, "success");
    editIndex = -1;
    addUpdateBtn.innerHTML = '<span class="icon">➕</span> Add Product';
  }

  clearForm();
  renderAll();
}

function editProduct(index) {
  const item = inventory[index];
  $("name").value = item.name;
  $("category").value = item.category || "";
  $("qty").value = item.qty;
  $("unit").value = item.unit || "pieces";
  $("price").value = item.price;
  $("minStock").value = item.minStock || settings.defaultMinStock;
  editIndex = index;
  addUpdateBtn.innerHTML = '<span class="icon">✏️</span> Update Product';
  $("name").focus();
  
  // Scroll to form
  document.querySelector('.product-form').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
}

function removeProduct(index) {
  const item = inventory[index];
  if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
  
  inventory.splice(index, 1);
  showNotification(`Product "${item.name}" deleted successfully!`, "success");
  renderAll();
}

function clearForm() {
  $("name").value = "";
  $("category").value = "";
  $("qty").value = "";
  $("unit").value = "pieces";
  $("price").value = "";
  $("minStock").value = settings.defaultMinStock;
  editIndex = -1;
  addUpdateBtn.innerHTML = '<span class="icon">➕</span> Add Product';
}

// ======== Enhanced Inventory Rendering ========
function renderInventory() {
  const tbody = $("inventory-list");
  const emptyState = $("inventory-empty");
  const countBadge = $("inventory-count");
  
  tbody.innerHTML = "";
  const filteredItems = getSortedFilteredInventory();
  
  if (filteredItems.length === 0) {
    emptyState.style.display = "block";
    emptyState.previousElementSibling.style.display = "none";
    countBadge.textContent = "(0 items)";
    return;
  }
  
  emptyState.style.display = "none";
  emptyState.previousElementSibling.style.display = "table";
  countBadge.textContent = `(${filteredItems.length} items)`;

  filteredItems.forEach((item) => {
    const idx = inventory.findIndex(inv => inv.id === item.id);
    const stockInfo = getStockStatus(item);
    const totalValue = round2(item.qty * item.price);
    
    const tr = document.createElement("tr");
    if (stockInfo.class) tr.className = stockInfo.class;
    
    tr.innerHTML = `
      <td><input type="checkbox" class="item-select" data-index="${idx}"></td>
      <td>
        <div class="product-info">
          <strong>${item.name}</strong>
          <small style="color: var(--text-secondary); display: block;">
            ID: ${item.id}
          </small>
        </div>
      </td>
      <td>
        <span class="category-badge">${item.category}</span>
      </td>
    <td>
  <span class="qty-display">${item.qty} ${item.unit || 'pcs'}</span>
  <small style="color: var(--text-secondary); display: block;">
    Min: ${item.minStock || settings.defaultMinStock} ${item.unit || 'pcs'}
  </small>
</td>
      <td>${formatINR(item.price)}</td>
      <td><strong>${formatINR(totalValue)}</strong></td>
      <td>
        <span class="status-badge ${stockInfo.badge}">
          ${stockInfo.status}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-info" onclick="editProduct(${idx})" title="Edit">
            ✏️
          </button>
          <button class="btn btn-sm btn-success" onclick="quickSale(${idx})" title="Quick Sale">
            💰
          </button>
          <button class="btn btn-sm btn-danger" onclick="removeProduct(${idx})" title="Delete">
            🗑️
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  updateLowStockAlert();
  updateDashboardStats();
}

function updateLowStockAlert() {
  const alertDiv = $("low-stock-alert");
  const lowStockItems = inventory.filter(item => {
    const minStock = item.minStock || settings.defaultMinStock;
    return item.qty <= minStock && item.qty > 0;
  });
  
  const outOfStockItems = inventory.filter(item => item.qty === 0);
  
  alertDiv.innerHTML = "";
  
  if (outOfStockItems.length > 0) {
    alertDiv.innerHTML += `
      <div class="alert danger">
        <strong>⚠️ ${outOfStockItems.length} items are out of stock!</strong>
        <div style="margin-top: 8px;">
          ${outOfStockItems.map(item => `• ${item.name}`).join('<br>')}
        </div>
      </div>
    `;
  }
  
  if (lowStockItems.length > 0) {
    alertDiv.innerHTML += `
      <div class="alert warning">
        <strong>📊 ${lowStockItems.length} items are running low!</strong>
        <div style="margin-top: 8px;">
          ${lowStockItems.map(item => `• ${item.name} (${item.qty} left)`).join('<br>')}
        </div>
      </div>
    `;
  }
}

// ======== Enhanced Filtering & Sorting ========
function getSortedFilteredInventory() {
  const query = $("search").value.toLowerCase().trim();
  const sortBy = $("sortBy").value;
  const sortDir = $("sortDir").value;
  const stockFilter = $("stockFilter").value;

  let filtered = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(query) || 
                         item.category.toLowerCase().includes(query);
    const matchesCategory = !currentCategoryFilter || 
                           item.category === currentCategoryFilter;
    
    let matchesStockFilter = true;
    if (stockFilter) {
      const stockInfo = getStockStatus(item);
      switch (stockFilter) {
        case "in-stock":
          matchesStockFilter = item.qty > (item.minStock || settings.defaultMinStock);
          break;
        case "low-stock":
          matchesStockFilter = item.qty <= (item.minStock || settings.defaultMinStock) && item.qty > 0;
          break;
        case "out-of-stock":
          matchesStockFilter = item.qty === 0;
          break;
      }
    }
    
    return matchesSearch && matchesCategory && matchesStockFilter;
  });

  filtered.sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case "name":
        valueA = a.name.toLowerCase();
        valueB = b.name.toLowerCase();
        break;
      case "category":
        valueA = a.category.toLowerCase();
        valueB = b.category.toLowerCase();
        break;
      case "value":
        valueA = a.qty * a.price;
        valueB = b.qty * b.price;
        break;
      default:
        valueA = a[sortBy];
        valueB = b[sortBy];
    }
    
    if (valueA < valueB) return sortDir === "asc" ? -1 : 1;
    if (valueA > valueB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return filtered;
}

function renderCategoryFilters() {
  const container = $("category-filter");
  const categories = [...new Set(inventory.map(item => item.category))];
  
  container.innerHTML = `
    <button class="category-filter-btn ${!currentCategoryFilter ? 'active' : ''}" 
            onclick="filterByCategory('')">
      All Categories
    </button>
  `;
  
  categories.forEach(category => {
    if (category) {
      container.innerHTML += `
        <button class="category-filter-btn ${currentCategoryFilter === category ? 'active' : ''}" 
                onclick="filterByCategory('${category}')">
          ${category}
        </button>
      `;
    }
  });
}

function filterByCategory(category) {
  currentCategoryFilter = category;
  renderInventory();
  renderCategoryFilters();
}

function clearSearch() {
  $("search").value = "";
  $("stockFilter").value = "";
  currentCategoryFilter = "";
  renderInventory();
  renderCategoryFilters();
}

function applySort() {
  renderInventory();
}

function searchProduct() {
  renderInventory();
}

// ======== Enhanced Sales Management ========
function updateSalePreview() {
  const productIndex = parseInt($("saleProduct").value, 10);
  const qty = parseInt($("saleQty").value, 10) || 0;
  const discountValue = parseFloat($("saleDiscount").value) || 0;
  const discountType = $("saleDiscountType").value;
  const roundingMode = $("rounding").value;
  
  const preview = $("sale-preview");
  
  if (isNaN(productIndex) || qty <= 0 || !inventory[productIndex]) {
    preview.style.display = "none";
    return;
  }
  
  const product = inventory[productIndex];
  const unitPrice = product.price;
  const subtotal = unitPrice * qty;
  
  let discount = 0;
  if (discountType === "flat") {
    discount = Math.min(discountValue, subtotal);
  } else {
    discount = Math.min((subtotal * discountValue) / 100, subtotal);
  }
  
  let total = subtotal - discount;
  total = round2(applyRounding(total, roundingMode));
  
  preview.innerHTML = `
    <h4>💰 Sale Preview</h4>
    <div class="sale-summary">
      <div class="sale-item">
        <div class="sale-item-label">Product</div>
        <div class="sale-item-value">${product.name}</div>
      </div>
      <div class="sale-item">
        <div class="sale-item-label">Quantity</div>
        <div class="sale-item-value">${qty}</div>
      </div>
      <div class="sale-item">
        <div class="sale-item-label">Unit Price</div>
        <div class="sale-item-value">${formatINR(unitPrice)}</div>
      </div>
      <div class="sale-item">
        <div class="sale-item-label">Subtotal</div>
        <div class="sale-item-value">${formatINR(subtotal)}</div>
      </div>
      <div class="sale-item">
        <div class="sale-item-label">Discount</div>
        <div class="sale-item-value">${formatINR(discount)}</div>
      </div>
      <div class="sale-item" style="border-top: 2px solid var(--primary); margin-top: 8px; padding-top: 8px;">
        <div class="sale-item-label">Total</div>
        <div class="sale-item-value" style="color: var(--primary); font-size: 1.3rem;">
          ${formatINR(total)}
        </div>
      </div>
    </div>
    ${qty > product.qty ? 
      `<div class="alert warning">⚠️ Insufficient stock! Available: ${product.qty}</div>` : 
      ''}
  `;
  
  preview.style.display = "block";
}

function renderSaleProductOptions() {
  const select = $("saleProduct");
  select.innerHTML = '<option value="">Select a product...</option>';
  
  inventory
    .filter(item => item.qty > 0)
    .forEach((item, originalIndex) => {
      const actualIndex = inventory.findIndex(inv => inv.id === item.id);
      const option = document.createElement("option");
      option.value = actualIndex;
      option.textContent = `${item.name} (${item.qty} ${item.unit || 'pcs'} available) - ${formatINR(item.price)}`;
      select.appendChild(option);
    });
}

function makeSale() {
  if (inventory.length === 0) {
    showNotification("No products available for sale!", "error");
    return;
  }
  
  const productIndex = parseInt($("saleProduct").value, 10);
  const qty = parseInt($("saleQty").value, 10);
  
  if (isNaN(productIndex) || isNaN(qty) || qty <= 0) {
    showNotification("Please select a product and enter a valid quantity!", "error");
    return;
  }

  const discountValue = parseFloat($("saleDiscount").value) || 0;
  const discountType = $("saleDiscountType").value;
  const roundingMode = $("rounding").value;

  const product = inventory[productIndex];
  if (!product) {
    showNotification("Selected product not found!", "error");
    return;
  }

  if (qty > product.qty) {
    showNotification(`Insufficient stock! Only ${product.qty} items available.`, "error");
    return;
  }

  const unitPrice = product.price;
  const subtotal = unitPrice * qty;

  let discount = 0;
  if (discountType === "flat") {
    discount = Math.min(discountValue, subtotal);
  } else {
    discount = Math.min((subtotal * discountValue) / 100, subtotal);
  }

  let total = subtotal - discount;
  total = round2(applyRounding(total, roundingMode));

  // Reduce stock
  product.qty -= qty;
  product.updatedAt = new Date().toISOString();

  // Record sale
  const sale = {
    id: generateId(),
    date: new Date().toISOString(),
    product: product.name,
    productId: product.id,
    qty: qty,
    price: unitPrice,
    subtotal: round2(subtotal),
    discountType: discountType,
    discountValue: round2(discountValue),
    discountApplied: round2(discount),
    total: total
  };

  salesHistory.unshift(sale); // Add to beginning for recent-first order
  
  clearSaleForm();
  renderAll();
  showNotification(`Sale completed! Total: ${formatINR(total)}`, "success");
}

function quickSale(productIndex) {
  const product = inventory[productIndex];
  if (product.qty === 0) {
    showNotification("This product is out of stock!", "error");
    return;
  }
  
  // Pre-fill the sale form
  $("saleProduct").value = productIndex;
  $("saleQty").value = 1;
  $("saleDiscount").value = 0;
  
  updateSalePreview();
  
  // Scroll to sales section
  document.querySelector('.sales-section').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
  
  $("saleQty").focus();
  $("saleQty").select();
}

function clearSaleForm() {
  $("saleProduct").value = "";
  $("saleQty").value = "";
  $("saleDiscount").value = "";
  $("sale-preview").style.display = "none";
}

function renderSalesHistory() {
  const tbody = $("sales-list");
  const emptyState = $("sales-empty");
  
  tbody.innerHTML = "";
  
  if (salesHistory.length === 0) {
    emptyState.style.display = "block";
    emptyState.previousElementSibling.style.display = "none";
    $("salesTotals").textContent = "No sales recorded yet.";
    return;
  }
  
  emptyState.style.display = "none";
  emptyState.previousElementSibling.style.display = "table";

  let totalRevenue = 0, totalDiscount = 0, totalOrders = 0, totalUnits = 0;

  // Show recent 50 sales to avoid performance issues
  const recentSales = salesHistory.slice(0, 50);
  
  recentSales.forEach((sale, index) => {
    const tr = document.createElement("tr");
    const dateTime = new Date(sale.date).toLocaleString("en-IN");
    
    tr.innerHTML = `
      <td>
        <div style="font-size: 0.9rem;">${dateTime}</div>
      </td>
      <td>
        <strong>${sale.product}</strong>
        <small style="color: var(--text-secondary); display: block;">
          ID: ${sale.productId || 'N/A'}
        </small>
      </td>
      <td><span class="qty-badge">${sale.qty}</span></td>
      <td>${formatINR(sale.price)}</td>
      <td>
        <div>
          ${sale.discountType === "percent" ? 
            `${sale.discountValue}%` : 
            formatINR(sale.discountValue)
          }
          <small style="color: var(--text-secondary); display: block;">
            (-${formatINR(sale.discountApplied)})
          </small>
        </div>
      </td>
      <td><strong>${formatINR(sale.total)}</strong></td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteSale(${index})" title="Delete Sale">
          🗑️
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Calculate totals from all sales
  salesHistory.forEach(sale => {
    totalRevenue += sale.total;
    totalDiscount += sale.discountApplied;
    totalOrders += 1;
    totalUnits += sale.qty;
  });

  $("salesTotals").innerHTML = `
    <div class="total-item">
      <div class="total-label">Total Orders</div>
      <div class="total-value">${totalOrders}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Units Sold</div>
      <div class="total-value">${totalUnits}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Total Discounts</div>
      <div class="total-value">${formatINR(totalDiscount)}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Total Revenue</div>
      <div class="total-value" style="color: var(--success); font-size: 1.3rem;">
        ${formatINR(totalRevenue)}
      </div>
    </div>
  `;
}

function deleteSale(index) {
  const sale = salesHistory[index];
  if (!confirm(`Delete this sale of ${sale.product}?`)) return;
  
  // Try to restore stock if product still exists
  const product = inventory.find(item => item.id === sale.productId);
  if (product) {
    product.qty += sale.qty;
    product.updatedAt = new Date().toISOString();
  }
  
  salesHistory.splice(index, 1);
  renderAll();
  showNotification("Sale deleted and stock restored!", "success");
}

// ======== Dashboard & Statistics ========
function updateDashboardStats() {
  const statsContainer = $("dashboard-stats");
  
  const totalProducts = inventory.length;
  const totalStock = inventory.reduce((sum, item) => sum + item.qty, 0);
  const totalValue = inventory.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const lowStockCount = inventory.filter(item => 
    item.qty <= (item.minStock || settings.defaultMinStock) && item.qty > 0
  ).length;
  const outOfStockCount = inventory.filter(item => item.qty === 0).length;
  
  const todaySales = getTodaySales();
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);

  statsContainer.innerHTML = `
    <div class="stat-card primary">
      <div class="stat-value">${totalProducts}</div>
      <div class="stat-label">Total Products</div>
    </div>
    <div class="stat-card success">
      <div class="stat-value">${totalStock}</div>
      <div class="stat-label">Total Stock Units</div>
    </div>
    <div class="stat-card info">
      <div class="stat-value">${formatINR(totalValue)}</div>
      <div class="stat-label">Inventory Value</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-value">${lowStockCount}</div>
      <div class="stat-label">Low Stock Items</div>
    </div>
    <div class="stat-card danger">
      <div class="stat-value">${outOfStockCount}</div>
      <div class="stat-label">Out of Stock</div>
    </div>
    <div class="stat-card success">
      <div class="stat-value">${formatINR(todayRevenue)}</div>
      <div class="stat-label">Today's Revenue</div>
    </div>
  `;
}

function getTodaySales() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  
  return salesHistory.filter(sale => {
    const saleTime = new Date(sale.date).getTime();
    return saleTime >= startOfDay && saleTime < endOfDay;
  });
}

// ======== Quick Actions ========
function showLowStockItems() {
  const lowStockItems = inventory.filter(item => {
    const minStock = item.minStock || settings.defaultMinStock;
    return item.qty <= minStock;
  });
  
  if (lowStockItems.length === 0) {
    showNotification("No low stock items found! 🎉", "success");
    return;
  }
  
  // Filter inventory to show only low stock items
  currentCategoryFilter = "";
  $("search").value = "";
  $("stockFilter").value = "low-stock";
  renderInventory();
  
  showNotification(`Found ${lowStockItems.length} low stock items`, "warning");
  
  // Scroll to inventory table
  document.querySelector('.inventory-table').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
}

function showTopProducts() {
  const productSales = {};
  
  salesHistory.forEach(sale => {
    if (!productSales[sale.product]) {
      productSales[sale.product] = {
        name: sale.product,
        totalQty: 0,
        totalRevenue: 0,
        orders: 0
      };
    }
    productSales[sale.product].totalQty += sale.qty;
    productSales[sale.product].totalRevenue += sale.total;
    productSales[sale.product].orders += 1;
  });
  
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);
  
  if (topProducts.length === 0) {
    showNotification("No sales data available for top products analysis", "info");
    return;
  }
  
  let message = "🏆 Top Selling Products by Revenue:\n\n";
  topProducts.forEach((product, index) => {
    message += `${index + 1}. ${product.name}\n`;
    message += `   Revenue: ${formatINR(product.totalRevenue)}\n`;
    message += `   Units Sold: ${product.totalQty}\n`;
    message += `   Orders: ${product.orders}\n\n`;
  });
  
  alert(message);
}

function generateReport() {
  renderDailyReport();
  document.querySelector('.report-table').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
}

function clearAllData() {
  const confirmMessage = `⚠️ WARNING: This will permanently delete ALL data including:
  
• ${inventory.length} products from inventory
• ${salesHistory.length} sales records
• All settings

This action CANNOT be undone!

Type "DELETE ALL" to confirm:`;

  const userInput = prompt(confirmMessage);
  
  if (userInput === "DELETE ALL") {
    inventory = [];
    salesHistory = [];
    settings = { defaultMinStock: 5, currency: "INR", notifications: true };
    
    localStorage.removeItem(LS_KEYS.INVENTORY);
    localStorage.removeItem(LS_KEYS.SALES);
    localStorage.removeItem(LS_KEYS.SETTINGS);
    
    renderAll();
    showNotification("All data has been cleared!", "success");
  } else if (userInput !== null) {
    showNotification("Data deletion cancelled - incorrect confirmation text", "info");
  }
}

// ======== Enhanced Selection Management ========
function toggleSelectAll() {
  const selectAll = $("select-all");
  const checkboxes = document.querySelectorAll(".item-select");
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAll.checked;
  });
}

function selectAllItems() {
  const checkboxes = document.querySelectorAll(".item-select");
  const selectAll = $("select-all");
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  selectAll.checked = true;
}

function deleteSelectedItems() {
  const selectedCheckboxes = document.querySelectorAll(".item-select:checked");
  const selectedIndices = Array.from(selectedCheckboxes)
    .map(cb => parseInt(cb.dataset.index))
    .sort((a, b) => b - a); // Sort in descending order for safe deletion
  
  if (selectedIndices.length === 0) {
    showNotification("Please select items to delete", "warning");
    return;
  }
  
  const confirmMessage = `Delete ${selectedIndices.length} selected items?`;
  if (!confirm(confirmMessage)) return;
  
  selectedIndices.forEach(index => {
    inventory.splice(index, 1);
  });
  
  renderAll();
  showNotification(`${selectedIndices.length} items deleted successfully!`, "success");
}

// ======== Export Functions ========
function exportCSV() {
  if (inventory.length === 0) {
    showNotification("No inventory data to export!", "warning");
    return;
  }
  
const headers = ["Name", "Category", "Quantity", "Unit", "Price", "Min Stock", "Total Value", "Status"];
const rows = inventory.map((item) => {
  const stockInfo = getStockStatus(item);
  return [
    item.name,
    item.category || "Other",
    item.qty,
    item.unit || "pieces", // Add this line
    item.price,
    item.minStock || settings.defaultMinStock,
    round2(item.qty * item.price),
    stockInfo.status
  ];
});
  
  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), 
              `inventory_${new Date().toISOString().split('T')[0]}.csv`);
  showNotification("Inventory exported successfully!", "success");
}

function exportExcel() {
  if (inventory.length === 0) {
    showNotification("No inventory data to export!", "warning");
    return;
  }
  
 const headers = ["Name", "Category", "Quantity", "Unit", "Price", "Min Stock", "Total Value", "Status"];
const rows = inventory.map((item) => {
  const stockInfo = getStockStatus(item);
  return [
    item.name,
    item.category || "Other",
    item.qty,
    item.unit || "pieces", // Add this line
    item.price,
    item.minStock || settings.defaultMinStock,
    round2(item.qty * item.price),
    stockInfo.status
  ];
});
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  showNotification("Inventory exported successfully!", "success");
}

function exportSalesCSV() {
  if (salesHistory.length === 0) {
    showNotification("No sales data to export!", "warning");
    return;
  }
  
  const headers = ["DateTime", "Product", "Quantity", "Unit Price", "Subtotal", "Discount Type", "Discount Value", "Discount Applied", "Total"];
  const rows = salesHistory.map(sale => [
    new Date(sale.date).toLocaleString("en-IN"),
    sale.product,
    sale.qty,
    sale.price,
    sale.subtotal || (sale.qty * sale.price),
    sale.discountType,
    sale.discountValue,
    sale.discountApplied,
    sale.total
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), 
              `sales_${new Date().toISOString().split('T')[0]}.csv`);
  showNotification("Sales data exported successfully!", "success");
}

function exportSalesExcel() {
  if (salesHistory.length === 0) {
    showNotification("No sales data to export!", "warning");
    return;
  }
  
  const headers = ["DateTime", "Product", "Quantity", "Unit Price", "Subtotal", "Discount Type", "Discount Value", "Discount Applied", "Total"];
  const data = salesHistory.map(sale => [
    new Date(sale.date).toLocaleString("en-IN"),
    sale.product,
    sale.qty,
    sale.price,
    sale.subtotal || (sale.qty * sale.price),
    sale.discountType,
    sale.discountValue,
    sale.discountApplied,
    sale.total
  ]);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales");
  XLSX.writeFile(wb, `sales_${new Date().toISOString().split('T')[0]}.xlsx`);
  showNotification("Sales data exported successfully!", "success");
}

// ======== WhatsApp Integration ========
function shareTodaySalesWhatsApp() {
  const todaySales = getTodaySales();
  
  if (todaySales.length === 0) {
    showNotification("No sales today to share!", "warning");
    return;
  }
  
  const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const totalUnits = todaySales.reduce((sum, sale) => sum + sale.qty, 0);
  const totalOrders = todaySales.length;
  
  const today = new Date().toLocaleDateString("en-IN");
  
  const message = `*📈 Daily Sales Report - ${today}*

*Summary:*
• Orders: ${totalOrders}
• Units Sold: ${totalUnits}
• Total Revenue: ${formatINR(totalRevenue)}

*Top Items:*
${todaySales
  .reduce((acc, sale) => {
    const existing = acc.find(item => item.product === sale.product);
    if (existing) {
      existing.qty += sale.qty;
      existing.revenue += sale.total;
    } else {
      acc.push({
        product: sale.product,
        qty: sale.qty,
        revenue: sale.total
      });
    }
    return acc;
  }, [])
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 5)
  .map(item => `• ${item.product}: ${item.qty} units - ${formatINR(item.revenue)}`)
  .join('\n')}

_Generated by Inventory Management System_`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
  
  window.open(whatsappUrl, "_blank");
  showNotification("WhatsApp share opened!", "success");
}

// ======== Reports System ========
let currentReport = {
  title: "",
  data: [],
  totals: { orders: 0, units: 0, revenue: 0 }
};

function groupSalesByPeriod(startTime = null, endTime = null, groupBy = 'day') {
  const salesInRange = salesHistory.filter(sale => {
    const saleTime = new Date(sale.date).getTime();
    const afterStart = !startTime || saleTime >= startTime;
    const beforeEnd = !endTime || saleTime < endTime;
    return afterStart && beforeEnd;
  });

  const grouped = {};
  let totalOrders = 0, totalUnits = 0, totalRevenue = 0;

  salesInRange.forEach(sale => {
    const saleDate = new Date(sale.date);
    let key;
    
    switch (groupBy) {
      case 'day':
        key = saleDate.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(saleDate);
        weekStart.setDate(saleDate.getDate() - saleDate.getDay());
        key = weekStart.toISOString().split('T')[0] + ' (Week)';
        break;
      case 'month':
        key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = saleDate.toISOString().split('T')[0];
    }
    
    if (!grouped[key]) {
      grouped[key] = { orders: 0, units: 0, revenue: 0 };
    }
    
    grouped[key].orders += 1;
    grouped[key].units += sale.qty;
    grouped[key].revenue += sale.total;
    
    totalOrders += 1;
    totalUnits += sale.qty;
    totalRevenue += sale.total;
  });

  const data = Object.keys(grouped)
    .sort()
    .map(key => ({
      period: key,
      orders: grouped[key].orders,
      units: grouped[key].units,
      revenue: round2(grouped[key].revenue),
      avgOrderValue: round2(grouped[key].revenue / grouped[key].orders)
    }));

  return {
    data,
    totals: {
      orders: totalOrders,
      units: totalUnits,
      revenue: round2(totalRevenue),
      avgOrderValue: totalOrders > 0 ? round2(totalRevenue / totalOrders) : 0
    }
  };
}

function renderDailyReport() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  
  const report = groupSalesByPeriod(startOfDay, endOfDay);
  currentReport = {
    title: `Daily Report - ${today.toLocaleDateString("en-IN")}`,
    data: report.data,
    totals: report.totals
  };
  
  renderReport();
}

function renderWeeklyReport() {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  
  const report = groupSalesByPeriod(startOfWeek.getTime(), endOfWeek.getTime());
  currentReport = {
    title: `Weekly Report - ${startOfWeek.toLocaleDateString("en-IN")} to ${new Date(endOfWeek.getTime() - 1).toLocaleDateString("en-IN")}`,
    data: report.data,
    totals: report.totals
  };
  
  renderReport();
}

function renderMonthlyReport() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();
  
  const report = groupSalesByPeriod(startOfMonth, endOfMonth);
  currentReport = {
    title: `Monthly Report - ${today.toLocaleDateString("en-IN", { month: 'long', year: 'numeric' })}`,
    data: report.data,
    totals: report.totals
  };
  
  renderReport();
}

function renderRangeReport() {
  const fromDate = $("customFrom").value;
  const toDate = $("customTo").value;
  
  if (!fromDate || !toDate) {
    showNotification("Please select both start and end dates!", "warning");
    return;
  }
  
  const startTime = new Date(fromDate).getTime();
  const endTime = new Date(toDate).getTime() + 24 * 60 * 60 * 1000; // Include the end date
  
  if (startTime >= endTime) {
    showNotification("End date must be after start date!", "error");
    return;
  }
  
  const report = groupSalesByPeriod(startTime, endTime);
  currentReport = {
    title: `Custom Report - ${new Date(fromDate).toLocaleDateString("en-IN")} to ${new Date(toDate).toLocaleDateString("en-IN")}`,
    data: report.data,
    totals: report.totals
  };
  
  renderReport();
}

function renderReport() {
  const titleElement = $("reportTitle");
  const tbody = $("reportBody");
  const emptyState = $("report-empty");
  const totalsElement = $("reportTotals");
  
  titleElement.textContent = currentReport.title;
  tbody.innerHTML = "";
  
  if (currentReport.data.length === 0) {
    emptyState.style.display = "block";
    emptyState.previousElementSibling.style.display = "none";
    totalsElement.textContent = "No sales data found for the selected period.";
    return;
  }
  
  emptyState.style.display = "none";
  emptyState.previousElementSibling.style.display = "table";
  
  currentReport.data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.period}</td>
      <td>${row.orders}</td>
      <td>${row.units}</td>
      <td>${formatINR(row.revenue)}</td>
      <td>${formatINR(row.avgOrderValue)}</td>
    `;
    tbody.appendChild(tr);
  });
  
  totalsElement.innerHTML = `
    <div class="total-item">
      <div class="total-label">Total Orders</div>
      <div class="total-value">${currentReport.totals.orders}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Units Sold</div>
      <div class="total-value">${currentReport.totals.units}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Total Revenue</div>
      <div class="total-value" style="color: var(--success); font-size: 1.3rem;">
        ${formatINR(currentReport.totals.revenue)}
      </div>
    </div>
    <div class="total-item">
      <div class="total-label">Avg Order Value</div>
      <div class="total-value">${formatINR(currentReport.totals.avgOrderValue)}</div>
    </div>
  `;
}

function exportReportCSV() {
  if (currentReport.data.length === 0) {
    showNotification("No report data to export!", "warning");
    return;
  }
  
  const headers = ["Date", "Orders", "Units Sold", "Revenue", "Avg Order Value"];
  const rows = currentReport.data.map(row => [
    row.period,
    row.orders,
    row.units,
    row.revenue,
    row.avgOrderValue
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), 
              `report_${new Date().toISOString().split('T')[0]}.csv`);
  showNotification("Report exported successfully!", "success");
}

function exportReportExcel() {
  if (currentReport.data.length === 0) {
    showNotification("No report data to export!", "warning");
    return;
  }
  
  const headers = ["Date", "Orders", "Units Sold", "Revenue", "Avg Order Value"];
  const data = currentReport.data.map(row => [
    row.period,
    row.orders,
    row.units,
    row.revenue,
    row.avgOrderValue
  ]);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `report_${new Date().toISOString().split('T')[0]}.xlsx`);
  showNotification("Report exported successfully!", "success");
}

// ======== Enhanced Charts System ========
function showChart(chartType) {
  // Update tab states
  document.querySelectorAll('.chart-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector(`[onclick="showChart('${chartType}')"]`).classList.add('active');
  
  // Update chart sections
  document.querySelectorAll('.chart-section').forEach(section => section.classList.remove('active'));
  document.getElementById(`chart-${chartType}`).classList.add('active');
  
  // Render specific chart
  switch (chartType) {
    case 'overview':
      renderOverviewCharts();
      break;
    case 'stock':
      renderStockCharts();
      break;
    case 'sales':
      renderSalesCharts();
      break;
    case 'category':
      renderCategoryCharts();
      break;
  }
}

function renderOverviewCharts() {
  renderStockChart();
  renderSalesChart();
}

function renderStockChart() {
  const ctx = document.getElementById("stockChart");
  if (!ctx) return;
  
  if (charts.stockChart) {
    charts.stockChart.destroy();
  }
  
  if (inventory.length === 0) {
    ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
    return;
  }
  
  // Group by category
  const categoryData = {};
  inventory.forEach(item => {
    const category = item.category || "Other";
    if (!categoryData[category]) {
      categoryData[category] = 0;
    }
    categoryData[category] += item.qty;
  });
  
  const labels = Object.keys(categoryData);
  const data = Object.values(categoryData);
  const colors = [
    '#0a84ff', '#34c759', '#ff9500', '#ff3b30', '#5ac8fa',
    '#af52de', '#ff2d92', '#64d2ff', '#30d158', '#ffd60a'
  ];
  
  charts.stockChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        label: "Stock by Category",
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0,
        hoverBorderWidth: 2,
        hoverBorderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} units (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderSalesChart() {
  const ctx = document.getElementById("salesChart");
  if (!ctx) return;
  
  if (charts.salesChart) {
    charts.salesChart.destroy();
  }
  
  if (salesHistory.length === 0) {
    ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
    return;
  }
  
  // Get last 30 days of sales
  const last30Days = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last30Days.push({
      date: dateStr,
      displayDate: date.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' }),
      revenue: 0
    });
  }
  
  // Aggregate sales by date
  salesHistory.forEach(sale => {
    const saleDate = new Date(sale.date).toISOString().split('T')[0];
    const dayData = last30Days.find(day => day.date === saleDate);
    if (dayData) {
      dayData.revenue += sale.total;
    }
  });
  
  charts.salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: last30Days.map(day => day.displayDate),
      datasets: [{
        label: "Daily Revenue",
        data: last30Days.map(day => day.revenue),
        borderColor: '#0a84ff',
        backgroundColor: 'rgba(10, 132, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0a84ff',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatINR(value);
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Revenue: ${formatINR(context.parsed.y)}`;
            }
          }
        }
      }
    }
  });
}

function renderStockCharts() {
  const ctx = document.getElementById("stockStatusChart");
  if (!ctx) return;
  
  if (charts.stockStatusChart) {
    charts.stockStatusChart.destroy();
  }
  
  const inStock = inventory.filter(item => {
    const minStock = item.minStock || settings.defaultMinStock;
    return item.qty > minStock;
  }).length;
  
  const lowStock = inventory.filter(item => {
    const minStock = item.minStock || settings.defaultMinStock;
    return item.qty <= minStock && item.qty > 0;
  }).length;
  
  const outOfStock = inventory.filter(item => item.qty === 0).length;
  
  charts.stockStatusChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["In Stock", "Low Stock", "Out of Stock"],
      datasets: [{
        label: "Number of Items",
        data: [inStock, lowStock, outOfStock],
        backgroundColor: ['#34c759', '#ff9500', '#ff3b30'],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderSalesCharts() {
  const ctx = document.getElementById("salesTrendChart");
  if (!ctx) return;
  
  if (charts.salesTrendChart) {
    charts.salesTrendChart.destroy();
  }
  
  if (salesHistory.length === 0) {
    ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
    return;
  }
  
  // Weekly sales trend
  const weeklyData = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i * 7);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    
    const weekSales = salesHistory.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= weekStart && saleDate < weekEnd;
    });
    
    const revenue = weekSales.reduce((sum, sale) => sum + sale.total, 0);
    const orders = weekSales.length;
    const units = weekSales.reduce((sum, sale) => sum + sale.qty, 0);
    
    weeklyData.push({
      week: `Week ${i === 0 ? 'Current' : i + 1}`,
      revenue,
      orders,
      units
    });
  }
  
  charts.salesTrendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: weeklyData.map(week => week.week),
      datasets: [
        {
          label: "Revenue",
          data: weeklyData.map(week => week.revenue),
          borderColor: '#0a84ff',
          backgroundColor: 'rgba(10, 132, 255, 0.1)',
          yAxisID: 'y',
          tension: 0.4
        },
        {
          label: "Orders",
          data: weeklyData.map(week => week.orders),
          borderColor: '#34c759',
          backgroundColor: 'rgba(52, 199, 89, 0.1)',
          yAxisID: 'y1',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          display: true,
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: {
            callback: function(value) {
              return formatINR(value);
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false,
          },
        },
      }
    }
  });
}

function renderCategoryCharts() {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;
  
  if (charts.categoryChart) {
    charts.categoryChart.destroy();
  }
  
  if (salesHistory.length === 0) {
    ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
    return;
  }
  
  // Category performance by revenue
  const categoryPerformance = {};
  
  salesHistory.forEach(sale => {
    const product = inventory.find(item => item.id === sale.productId || item.name === sale.product);
    const category = product ? (product.category || "Other") : "Other";
    
    if (!categoryPerformance[category]) {
      categoryPerformance[category] = {
        revenue: 0,
        orders: 0,
        units: 0
      };
    }
    
    categoryPerformance[category].revenue += sale.total;
    categoryPerformance[category].orders += 1;
    categoryPerformance[category].units += sale.qty;
  });
  
  const categories = Object.keys(categoryPerformance);
  const revenues = Object.values(categoryPerformance).map(cat => cat.revenue);
  const colors = [
    '#0a84ff', '#34c759', '#ff9500', '#ff3b30', '#5ac8fa',
    '#af52de', '#ff2d92', '#64d2ff', '#30d158', '#ffd60a'
  ];
  
  charts.categoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: categories,
      datasets: [{
        label: "Revenue by Category",
        data: revenues,
        backgroundColor: colors.slice(0, categories.length),
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const category = context.label;
              const performance = categoryPerformance[category];
              return [
                `Revenue: ${formatINR(performance.revenue)}`,
                `Orders: ${performance.orders}`,
                `Units: ${performance.units}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatINR(value);
            }
          }
        }
      }
    }
  });
}

// ======== Notifications System ========
function showNotification(message, type = 'info', duration = 3000) {
  const container = $('notifications');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 12px;">
      <span style="font-size: 1.2em;">${icons[type] || icons.info}</span>
      <div style="flex: 1;">${message}</div>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, duration);
  }
}

// ======== Footer Statistics ========
function updateFooterStats() {
  const footerStats = $('footer-stats');
  if (!footerStats) return;
  
  const totalProducts = inventory.length;
  const totalStock = inventory.reduce((sum, item) => sum + item.qty, 0);
  const totalSales = salesHistory.length;
  const totalRevenue = salesHistory.reduce((sum, sale) => sum + sale.total, 0);
  
  footerStats.innerHTML = `
    <div class="footer-stat">
      <span class="footer-stat-value">${totalProducts}</span>
      <span class="footer-stat-label">Products</span>
    </div>
    <div class="footer-stat">
      <span class="footer-stat-value">${totalStock}</span>
      <span class="footer-stat-label">Stock Units</span>
    </div>
    <div class="footer-stat">
      <span class="footer-stat-value">${totalSales}</span>
      <span class="footer-stat-label">Sales Made</span>
    </div>
    <div class="footer-stat">
      <span class="footer-stat-value">${formatINR(totalRevenue)}</span>
      <span class="footer-stat-label">Total Revenue</span>
    </div>
  `;
}

// ======== Utility Functions ========
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showLoading() {
  $('loading').style.display = 'flex';
}

function hideLoading() {
  $('loading').style.display = 'none';
}

// ======== Main Render Function ========
function renderAll() {
  showLoading();
  
  setTimeout(() => {
    renderInventory();
    renderSaleProductOptions();
    renderSalesHistory();
    renderCategoryFilters();
    updateDashboardStats();
    updateFooterStats();
    showChart('overview'); // Default chart view
    saveAll();
    hideLoading();
  }, 100);
}

// ======== Initialization ========
function init() {
  // Set default date values for reports
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);
  
  $("customFrom").value = oneWeekAgo.toISOString().split('T')[0];
  $("customTo").value = today.toISOString().split('T')[0];
  
  // Add event listeners
  $("saleProduct").addEventListener('change', updateSalePreview);
  $("saleQty").addEventListener('input', updateSalePreview);
  $("saleDiscount").addEventListener('input', updateSalePreview);
  $("saleDiscountType").addEventListener('change', updateSalePreview);
  $("rounding").addEventListener('change', updateSalePreview);
  
  // Initialize display
  renderAll();
  renderDailyReport(); // Default report
  
  // Show welcome message for new users
  if (inventory.length === 0 && salesHistory.length === 0) {
    showNotification("Welcome to Inventory Management System! Add your first product to get started.", "info", 5000);
  }
  
  console.log("✅ Inventory Management System initialized successfully!");
}

// Start the application
document.addEventListener('DOMContentLoaded', init);