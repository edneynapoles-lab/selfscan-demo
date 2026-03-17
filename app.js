(() => {
  const LS_STORE_KEY = "selfscan_store";
  const LS_CUSTOMER_KEY = "selfscan_customer";

  let storeCode = "";
  let customerDoc = "";
  let cart = [];
  let selectedPaymentMethod = "qr";
  let currentProduct = null;

  const demoCatalog = [
    { code: "7501001", name: "Shampoo Dermoprotector", desc: "Cuidado diario para todo tipo de cabello.", price: 5990, format: "Unidad", emoji: "🧴" },
    { code: "7501002", name: "Crema Hidratante Facial", desc: "Hidratación ligera de uso diario.", price: 8990, format: "Unidad", emoji: "🧴" },
    { code: "7803001", name: "Protector Solar FPS 50", desc: "Protección alta para uso diario.", price: 12990, format: "Unidad", emoji: "☀️" },
    { code: "1002003", name: "Vitamina C 1g", desc: "Suplemento en tabletas.", price: 7490, format: "Caja", emoji: "💊" }
  ];

  function $(id) { return document.getElementById(id); }

  function money(value) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  function normalizeStore(value = "") { return String(value).replace(/\D/g, "").slice(0, 4); }
  function normalizeCustomer(value = "") { return String(value).replace(/[^0-9kK]/g, "").toUpperCase(); }

  function showToast(message, ms = 2500) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("show"), ms);
  }

  function getStoreFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalizeStore(params.get("store") || "");
  }

  function removeStoreFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("store");
    const clean = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, clean || url.pathname);
  }

  function loadStore() {
    const fromStorage = localStorage.getItem(LS_STORE_KEY) || "";
    storeCode = normalizeStore(fromStorage);
  }

  function saveStore(code) {
    storeCode = normalizeStore(code);
    if (storeCode) localStorage.setItem(LS_STORE_KEY, storeCode);
    else localStorage.removeItem(LS_STORE_KEY);
    syncStoreUi();
  }

  function bootstrapStoreFromUrl() {
    const urlStore = getStoreFromUrl();
    if (!urlStore) return;
    saveStore(urlStore);
    removeStoreFromUrl();
  }

  function loadCustomer() {
    customerDoc = normalizeCustomer(localStorage.getItem(LS_CUSTOMER_KEY) || "");
  }

  function saveCustomer(doc) {
    customerDoc = normalizeCustomer(doc);
    if (customerDoc) localStorage.setItem(LS_CUSTOMER_KEY, customerDoc);
    else localStorage.removeItem(LS_CUSTOMER_KEY);
    syncCustomerUi();
  }

  function syncStoreUi() {
    const label = storeCode ? `Local ${storeCode}` : "Local no informado";
    if ($("storeBadge")) $("storeBadge").textContent = label;
    if ($("storeDisplayHome")) $("storeDisplayHome").textContent = label;
    if ($("cartStoreHint")) $("cartStoreHint").textContent = label;
    if ($("paymentStoreText")) $("paymentStoreText").textContent = label;
  }

  function syncCustomerUi() {
    const label = customerDoc || "Invitado";
    if ($("cartCustomerHint")) $("cartCustomerHint").textContent = label;
    if ($("paymentCustomerText")) $("paymentCustomerText").textContent = `Cliente ${label}`;
    if ($("customerDoc")) $("customerDoc").value = customerDoc;
  }

  function goTo(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
    const screen = $(screenId);
    if (screen) {
      screen.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (screenId === "cart") renderCart();
    if (screenId === "payment") renderPayment();
    if (screenId === "qrpay") renderQr();
  }

  function findProduct(term) {
    const query = String(term || "").trim().toLowerCase();
    if (!query) return null;
    return demoCatalog.find((item) =>
      item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)
    ) || null;
  }

  function renderSearchResult(product) {
    const box = $("demoList");
    if (!box) return;
    box.innerHTML = "";
    if (!product) {
      box.innerHTML = `<div class="empty-state">No se encontró el producto.</div>`;
      return;
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "product-row";
    item.innerHTML = `
      <div class="product-thumb">${product.emoji}</div>
      <div class="product-main">
        <strong>${product.name}</strong>
        <div class="muted small">Código: ${product.code}</div>
        <div class="muted small">${product.desc}</div>
      </div>
      <div class="product-price">${money(product.price)}</div>
    `;
    item.addEventListener("click", () => openProduct(product));
    box.appendChild(item);
  }

  function openProduct(product) {
    currentProduct = product;
    if ($("productHero")) $("productHero").textContent = product.emoji;
    if ($("productName")) $("productName").textContent = product.name;
    if ($("productDesc")) $("productDesc").textContent = product.desc;
    if ($("productSalePrice")) $("productSalePrice").textContent = money(product.price);
    if ($("productCode")) $("productCode").textContent = product.code;
    if ($("productFormat")) $("productFormat").textContent = product.format;
    goTo("product");
  }

  function addToCart(product, qty = 1) {
    const found = cart.find((item) => item.code === product.code);
    if (found) found.qty += qty;
    else cart.push({ code: product.code, name: product.name, desc: product.desc, price: product.price, format: product.format, emoji: product.emoji, qty });
    renderCart();
    showToast("Producto agregado al carrito");
  }

  function removeFromCart(code) {
    cart = cart.filter((item) => item.code !== code);
    renderCart();
  }

  function changeQty(code, delta) {
    const item = cart.find((p) => p.code === code);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) return removeFromCart(code);
    renderCart();
  }

  function cartSubtotal() { return cart.reduce((sum, item) => sum + (item.price * item.qty), 0); }

  function renderCart() {
    const list = $("cartList");
    const subtotal = cartSubtotal();
    if ($("subtotal")) $("subtotal").textContent = money(subtotal);
    if ($("total")) $("total").textContent = money(subtotal);
    if (!list) return;
    if (!cart.length) {
      list.innerHTML = `<div class="empty-state">Aún no agregaste productos.</div>`;
      return;
    }
    list.innerHTML = "";
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-left">
          <div class="product-thumb">${item.emoji}</div>
          <div>
            <strong>${item.name}</strong>
            <div class="muted small">Código: ${item.code}</div>
            <div class="muted small">${money(item.price)} c/u</div>
          </div>
        </div>
        <div class="cart-right">
          <div class="qty-box">
            <button type="button" class="qty-btn qty-minus">-</button>
            <span>${item.qty}</span>
            <button type="button" class="qty-btn qty-plus">+</button>
          </div>
          <strong>${money(item.price * item.qty)}</strong>
          <button type="button" class="link-btn remove-btn">Eliminar</button>
        </div>
      `;
      row.querySelector(".qty-minus").addEventListener("click", () => changeQty(item.code, -1));
      row.querySelector(".qty-plus").addEventListener("click", () => changeQty(item.code, 1));
      row.querySelector(".remove-btn").addEventListener("click", () => removeFromCart(item.code));
      list.appendChild(row);
    });
  }

  function renderPayment() {
    const total = cartSubtotal();
    if ($("paymentTotal")) $("paymentTotal").textContent = money(total);
    syncStoreUi();
    syncCustomerUi();
    document.querySelectorAll(".pay-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.method === selectedPaymentMethod);
    });
  }

  function renderQr() {
    const box = $("qrBox");
    if (!box) return;
    const base = `${window.location.origin}${window.location.pathname}`;
    const qrUrl = storeCode ? `${base}?store=${storeCode}` : base;
    box.innerHTML = `
      <div class="qr-demo">
        <div class="qr-fake">
          <div class="qr-corner tl"></div>
          <div class="qr-corner tr"></div>
          <div class="qr-corner bl"></div>
          <div class="qr-grid"></div>
        </div>
        <div class="qr-text">
          <strong>URL QR</strong>
          <small>${qrUrl}</small>
        </div>
      </div>
    `;
  }

  function buildSaleRecord() {
    return {
      store: storeCode || null,
      customer: customerDoc || null,
      total: cartSubtotal(),
      items: cart.map((item) => ({ code: item.code, name: item.name, qty: item.qty, price: item.price })),
      ts: new Date().toISOString()
    };
  }

  function processPayment() {
    if (!storeCode) return showToast("No se puede pagar sin local informado");
    if (!cart.length) return showToast("Agrega al menos un producto al carrito");
    const sale = buildSaleRecord();
    const orderNumber = Math.floor(Math.random() * 9000) + 1000;
    if ($("successTotal")) $("successTotal").textContent = money(sale.total);
    if ($("successOrder")) $("successOrder").textContent = String(orderNumber);
    if ($("orderRef")) $("orderRef").textContent = String(orderNumber);
    console.log("SALE_RECORD", sale);
    goTo("success");
  }

  function bindEvents() {
    document.querySelectorAll("[data-go]").forEach((btn) => btn.addEventListener("click", () => goTo(btn.dataset.go)));
    $("goScanBtn")?.addEventListener("click", () => goTo("scan"));
    $("goCartBtn")?.addEventListener("click", () => goTo("cart"));
    $("resetStoreBtn")?.addEventListener("click", () => { saveStore(""); showToast("Local guardado eliminado"); });
    $("manualSearchBtn")?.addEventListener("click", () => {
      const code = $("manualCode")?.value || "";
      const product = findProduct(code);
      renderSearchResult(product);
      if (!product) showToast("Producto no encontrado");
    });
    $("manualCode")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        $("manualSearchBtn")?.click();
      }
    });
    $("fakeScanBtn")?.addEventListener("click", () => {
      const randomProduct = demoCatalog[Math.floor(Math.random() * demoCatalog.length)];
      renderSearchResult(randomProduct);
      showToast(`Producto detectado: ${randomProduct.name}`);
    });
    $("addProductBtn")?.addEventListener("click", () => {
      if (!currentProduct) return;
      addToCart(currentProduct, 1);
      goTo("cart");
    });
    $("lookupCustomerBtn")?.addEventListener("click", () => {
      const doc = $("customerDoc")?.value || "";
      const normalized = normalizeCustomer(doc);
      if (!normalized) return showToast("Ingresa un documento válido");
      saveCustomer(normalized);
      showToast("Cliente aplicado");
      goTo("cart");
    });
    $("clearCustomerBtn")?.addEventListener("click", () => { saveCustomer(""); showToast("Cliente eliminado"); });
    $("goPaymentBtn")?.addEventListener("click", () => {
      if (!cart.length) return showToast("El carrito está vacío");
      goTo("payment");
    });
    document.querySelectorAll(".pay-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPaymentMethod = btn.dataset.method || "qr";
        renderPayment();
      });
    });
    $("continuePaymentBtn")?.addEventListener("click", () => {
      if (!storeCode) return showToast("Debes abrir la app con un local, por ejemplo ?store=398");
      if (selectedPaymentMethod === "qr") goTo("qrpay");
      else processPayment();
    });
    $("approveQrBtn")?.addEventListener("click", () => processPayment());
  }

  function init() {
    loadStore();
    bootstrapStoreFromUrl();
    loadCustomer();
    syncStoreUi();
    syncCustomerUi();
    renderCart();
    bindEvents();
    if (!storeCode) showToast("Sugerencia: abre la app con ?store=398");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
