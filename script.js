const months = [
    { id: 'oct-2025', name: 'Octubre 2025', visible: true },
    { id: 'nov-2025', name: 'Noviembre 2025', visible: true },
    { id: 'dic-2025', name: 'Diciembre 2025', visible: true },
    { id: 'ene-2026', name: 'Enero 2026', visible: true },
    { id: 'feb-2026', name: 'Febrero 2026', visible: true },
    { id: 'mar-2026', name: 'Marzo 2026', visible: true },
    { id: 'abr-2026', name: 'Abril 2026', visible: true },
    { id: 'may-2026', name: 'Mayo 2026', visible: true },
    { id: 'jun-2026', name: 'Junio 2026', visible: true },
    { id: 'jul-2026', name: 'Julio 2026', visible: true },
    { id: 'ago-2026', name: 'Agosto 2026', visible: true },
    { id: 'sep-2026', name: 'Septiembre 2026', visible: true },
    { id: 'oct-2026', name: 'Octubre 2026', visible: false }
];

let orders = [];
let currentMonth = null;
let productCounter = 0;
let currentSortOption = 'date-asc';
let unsubscribe = null;
let customProducts = [];
let productsUnsubscribe = null;
let inventoryMaterials = [];
let productRecipes = [];
let materialsUnsubscribe = null;
let recipesUnsubscribe = null;
let recipeMaterialCounter = 0;

// Función para generar número de pedido
// Función para generar número de pedido secuencial
async function generateOrderNumber() {
    const { collection, query, where, getDocs } = window.firestoreLib;
    const q = query(
        collection(window.db, 'orders'),
        where('userId', '==', window.currentUser.uid)
    );
    
    const snapshot = await getDocs(q);
    let maxNumber = 0;
    
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.orderNumber && typeof data.orderNumber === 'number') {
            maxNumber = Math.max(maxNumber, data.orderNumber);
        }
    });
    
    return maxNumber + 1;
}
// Función para manejar cambio de producto
function handleProductChange(selectElement, productId) {
    const value = selectElement.value;
    const sheetsGroup = document.getElementById(`sheets-group-${productId}`);
    const sheetsInput = sheetsGroup.querySelector('.product-sheets');
    
    // Mostrar campo de hojas solo para cuadernos
    if (value === 'Cuaderno anillado tapa dura' || value === 'Cuaderno tapa blanda abrochado') {
        sheetsGroup.style.display = 'block';
        sheetsInput.required = true;
    } else {
        sheetsGroup.style.display = 'none';
        sheetsInput.required = false;
        sheetsInput.value = '';
    }
        // 🔥 NUEVO: mostrar cantidad de planchas si es sticker
    const stickerGroup = document.getElementById(`sheets-stickers-${productId}`);
    const stickerInput = stickerGroup.querySelector('.sheets-stickers-input');

    if (value.toLowerCase().includes("sticker")) {
        stickerGroup.style.display = "block";
        stickerInput.required = true;
    } else {
        stickerGroup.style.display = "none";
        stickerInput.required = false;
        stickerInput.value = "";
    }
}

// 🔧 Función para enviar email cuando cambia el estado
async function sendOrderStatusEmail(order, oldStatus, newStatus) {
    if (!order.emailComprador || oldStatus === newStatus) return;
    
    try {
        await emailjs.send('service_j1geh17', 'template_vofz6ar', {
            to_email: order.emailComprador,
            to_name: order.customerName,
            order_status: newStatus,
            payment_status: order.paymentStatus,
            products_list: order.products.map(p => `${p.name} - $${p.price.toFixed(2)}`).join('\n'),
            total_price: order.totalPrice.toFixed(2),
            delivery_date: order.deliveryDate || 'Por confirmar'
        });
        
        console.log('✅ Email de actualización enviado a:', order.emailComprador);
    } catch (error) {
        console.error('❌ Error al enviar email de actualización:', error);
        Swal.fire({
            title: 'Pedido actualizado',
            text: 'Pero hubo un error al enviar el email de notificación',
            icon: 'warning',
            confirmButtonColor: '#667eea'
        });    }
}

async function sendNewOrderEmail(order) {
    if (!order.emailComprador) return;
    
    try {
        await emailjs.send('service_j1geh17', 'template_ebl81v4', {
            to_email: order.emailComprador,
            to_name: order.customerName,
            products_list: order.products.map(p => `${p.name} - $${p.price.toFixed(2)}`).join('\n'),
            total_price: order.totalPrice.toFixed(2),
            delivery_date: order.deliveryDate || 'Por confirmar'
        });
        
        console.log('✅ Email de nuevo pedido enviado a:', order.emailComprador);
    } catch (error) {
        console.error('❌ Error al enviar email de nuevo pedido:', error);
        Swal.fire({
            title: 'Pedido creado',
            text: 'Pero hubo un error al enviar el email de confirmación',
            icon: 'warning',
            confirmButtonColor: '#667eea'
        });    }
}

function init() {
    renderMonths();
    selectMonth(months[0].id);
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    loadOrders();
    loadCustomProducts();
    loadInventoryMaterials(); 
    loadProductRecipes();     
}
function loadOrders() {
    if (unsubscribe) unsubscribe();
    
    const { collection, query, where, onSnapshot } = window.firestoreLib;
    const q = query(
        collection(window.db, 'orders'),
        where('userId', '==', window.currentUser.uid)
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        orders = [];
        snapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        renderOrders();
    });
}

function renderMonths() {
    const grid = document.getElementById('monthsGrid');
    grid.innerHTML = months.map(month => `
        <div class="month-button ${currentMonth === month.id ? 'active' : ''} ${!month.visible ? 'hidden' : ''}" 
             onclick="selectMonth('${month.id}')"
             data-month="${month.id}">
            ${month.name}
            <button class="toggle-visibility" onclick="event.stopPropagation(); toggleMonthVisibility('${month.id}')" title="Ocultar/Mostrar">
                ${month.visible ? '👁️' : '🚫'}
            </button>
        </div>
    `).join('');

    const select = document.getElementById('monthsSelect');
    select.innerHTML = months
        .filter(m => m.visible)
        .map(month => `
            <option value="${month.id}" ${currentMonth === month.id ? 'selected' : ''}>
                ${month.name}
            </option>
        `).join('');
}

function selectMonth(monthId) {
    currentMonth = monthId;
    renderMonths();
    renderOrders();
}

function toggleMonthVisibility(monthId) {
    const month = months.find(m => m.id === monthId);
    if (month) {
        month.visible = !month.visible;
        renderMonths();
    }
}

function changeSortOption() {
    currentSortOption = document.getElementById('sortSelect').value;
    renderOrders();
}

function openModal(orderId = null) {
    document.getElementById('orderModal').style.display = 'block';
    document.getElementById('productsContainer').innerHTML = '';
    productCounter = 0;

    if (orderId) {
        // Modo edición - mostrar todos los campos
        document.getElementById('paymentStatusGroup').style.display = 'block';
        document.getElementById('orderStatusGroup').style.display = 'block';
        document.getElementById('emailGroup').style.display = 'block';
        document.getElementById('phoneGroup').style.display = 'block';
        
        const order = orders.find(o => o.id === orderId);
        if (order) {
            document.getElementById('modalTitle').textContent = 'Editar Pedido';
            document.getElementById('submitBtn').textContent = 'Actualizar Pedido';
            document.getElementById('editingOrderId').value = orderId;
            document.getElementById('customerName').value = order.customerName;
            document.getElementById('customerEmail').value = order.emailComprador || '';
            document.getElementById('customerPhone').value = order.telefonoComprador || '';
            document.getElementById('orderDate').value = order.date;
            document.getElementById('deliveryDate').value = order.deliveryDate || '';
            document.getElementById('paymentMethod').value = order.paymentMethod;
            document.getElementById('paymentStatus').value = order.paymentStatus;
            document.getElementById('orderStatus').value = order.orderStatus;

            order.products.forEach(product => {
                addProduct(product);
            });
        }
    } else {
        // Modo nuevo pedido
        document.getElementById('paymentStatusGroup').style.display = 'none';
        document.getElementById('orderStatusGroup').style.display = 'none';
        document.getElementById('emailGroup').style.display = 'block';
        document.getElementById('phoneGroup').style.display = 'block';
        
        document.getElementById('modalTitle').textContent = 'Nuevo Pedido';
        document.getElementById('submitBtn').textContent = 'Guardar Pedido';
        document.getElementById('editingOrderId').value = '';
        document.getElementById('customerEmail').value = '';
        document.getElementById('customerPhone').value = '';
        addProduct();
    }
    
    updateTotalPrice();
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
    document.getElementById('orderForm').reset();
    productCounter = 0;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    document.getElementById('deliveryDate').value = '';
}

function addProduct(productData = null) {
    productCounter++;
    const container = document.getElementById('productsContainer');
    const productDiv = document.createElement('div');
    productDiv.className = 'product-item';
    productDiv.id = `product-${productCounter}`;
    productDiv.innerHTML = `
        ${productCounter > 1 ? '<button type="button" class="remove-product" onclick="removeProduct(' + productCounter + ')">×</button>' : ''}
        
        <div class="form-group">
            <label>Producto *</label>
            <select class="product-name" required onchange="handleProductChange(this, ${productCounter})">
                <option value="">Seleccionar producto...</option>
                ${getAllProducts().map(p => `
                    <option value="${p.value}" ${productData?.name === p.value ? 'selected' : ''}>${p.label}</option>
                `).join('')}
            </select>
        </div>

        <div class="form-group product-sheets-group" id="sheets-group-${productCounter}" style="display: none;">
            <label>Cantidad de Hojas *</label>
            <input type="number" class="product-sheets" min="1" value="${productData?.sheets || ''}" placeholder="Ej: 80">
        </div>

        <div class="form-group product-sheets-stickers" id="sheets-stickers-${productCounter}" style="display:none;">
            <label>Cantidad de planchas *</label>
            <input type="number" class="sheets-stickers-input" min="1" placeholder="Ej: 10">
        </div>

        <div class="form-group">
            <label>Descripción</label>
            <textarea class="product-description" placeholder="Detalles adicionales...">${productData?.description || ''}</textarea>
        </div>

        <div class="form-group">
            <label>Color de Anillado *</label>
            <input type="text" class="product-color" required value="${productData?.color || ''}">
        </div>

        <div class="form-group">
            <label>Foto de la Tapa</label>
            <input type="file" class="product-cover" accept="image/*" onchange="previewImage(this, ${productCounter})">
            <img class="image-preview" id="preview-${productCounter}" ${productData?.coverImage ? `src="${productData.coverImage}" style="display:block;"` : ''}>
            <input type="hidden" class="existing-cover-image" value="${productData?.coverImage || ''}">
        </div>

        <div class="form-group">
            <label>Texto de la Tapa</label>
            <input type="text" class="product-cover-text" value="${productData?.coverText || ''}">
        </div>

        <div class="form-group">
            <label>Precio *</label>
            <input type="number" class="product-price" step="0.01" min="0" required onchange="updateTotalPrice()" oninput="updateTotalPrice()" value="${productData?.price || ''}">
        </div>
    `;
    container.appendChild(productDiv);
    
    // Mostrar campo de hojas si es necesario
    if (productData && (productData.name === 'Cuaderno anillado tapa dura' || productData.name === 'Cuaderno tapa blanda abrochado')) {
        const sheetsGroup = document.getElementById(`sheets-group-${productCounter}`);
        sheetsGroup.style.display = 'block';
        sheetsGroup.querySelector('.product-sheets').required = true;
    }
    
    updateTotalPrice();
}

function removeProduct(id) {
    const product = document.getElementById(`product-${id}`);
    if (product) {
        product.remove();
        updateTotalPrice();
    }
}

function updateTotalPrice() {
    const priceInputs = document.querySelectorAll('.product-price');
    let total = 0;
    priceInputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        total += value;
    });
    document.getElementById('totalPrice').textContent = '$' + total.toFixed(2);
}

function previewImage(input, id) {
    const preview = document.getElementById(`preview-${id}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

document.getElementById('orderForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const editingOrderId = document.getElementById('editingOrderId').value;
    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const orderDate = document.getElementById('orderDate').value;
    const deliveryDate = document.getElementById('deliveryDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const paymentStatus = document.getElementById('paymentStatus').value;
    const orderStatus = document.getElementById('orderStatus').value;

    // ⚠️ ALERTAS DE CONFIRMACIÓN
    if (editingOrderId) {
        const confirmUpdate = await Swal.fire({
            title: '¿Actualizar este pedido?',
            html: customerEmail 
                ? '📧 Se enviará un email de notificación si cambió el estado del pedido.' 
                : '⚠️ No se enviará email (no hay email del cliente).',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#667eea',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, actualizar',
            cancelButtonText: 'Cancelar'
        });
        if (!confirmUpdate.isConfirmed) return;
    } else {
        const confirmCreate = await Swal.fire({
            title: '¿Crear este pedido?',
            html: customerEmail 
                ? '📧 Se enviará un email de confirmación al cliente.' 
                : '⚠️ No se enviará email (no hay email del cliente).',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#667eea',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, crear',
            cancelButtonText: 'Cancelar'
        });
        if (!confirmCreate.isConfirmed) return;
    }

    // 🔄 MOSTRAR LOADING
    Swal.fire({
        title: editingOrderId ? 'Actualizando pedido...' : 'Guardando pedido...',
        html: customerEmail ? 'Por favor espera mientras se guarda el pedido y se envía el email' : 'Por favor espera...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // 🔧 PROCESAR PRODUCTOS CON PROMISE.ALL (SOLUCIÓN)
    const productItems = document.querySelectorAll('.product-item');
    const productPromises = Array.from(productItems).map(item => {
        return new Promise((resolve) => {
            const name = item.querySelector('.product-name').value;
            const sheets = item.querySelector('.product-sheets').value || null;
            const description = item.querySelector('.product-description').value;
            const color = item.querySelector('.product-color').value;
            const coverInput = item.querySelector('.product-cover');
            const existingCoverImage = item.querySelector('.existing-cover-image').value;
            const coverText = item.querySelector('.product-cover-text').value;
            const price = parseFloat(item.querySelector('.product-price').value);
            const stickerSheetsInput = item.querySelector('.sheets-stickers-input');
            const stickerSheets = stickerSheetsInput && stickerSheetsInput.value ? parseInt(stickerSheetsInput.value) : null;
           
            if (coverInput.files && coverInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    resolve({
                        name,
                        sheets,
                        description,    
                        color,
                        coverImage: e.target.result,
                        coverText,
                        price,
                        stickerSheets
                    });
                };
                reader.readAsDataURL(coverInput.files[0]);
            } else {
                resolve({
                    name,
                    sheets,
                    description,
                    color,
                    stickerSheets,
                    coverImage: existingCoverImage || null,
                    coverText,
                    price
                });
            }
        });
    });

    try {
        const products = await Promise.all(productPromises);
        const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
        const { collection, addDoc, updateDoc, doc } = window.firestoreLib;

        if (editingOrderId) {
            // EDITAR PEDIDO EXISTENTE
            const oldOrder = orders.find(o => o.id === editingOrderId);
            const oldStatus = oldOrder?.orderStatus;
            
            const orderRef = doc(window.db, 'orders', editingOrderId);
            await updateDoc(orderRef, {
                customerName,
                emailComprador: customerEmail,
                telefonoComprador: customerPhone,
                products,
                paymentMethod,
                paymentStatus,
                orderStatus,
                totalPrice,
                date: orderDate,
                deliveryDate,
                updatedAt: new Date().toISOString()
            });
            
            // 📧 ENVIAR EMAIL SI CAMBIÓ EL ESTADO DEL PEDIDO
            if (oldStatus !== orderStatus && customerEmail) {
                await sendOrderStatusEmail({
                    customerName,
                    emailComprador: customerEmail,
                    products,
                    paymentStatus,
                    orderStatus,
                    totalPrice,
                    deliveryDate
                }, oldStatus, orderStatus);
            }
        } else {
            // CREAR NUEVO PEDIDO
            const orderNumber = await generateOrderNumber();
            
            await addDoc(collection(window.db, 'orders'), {
                userId: window.currentUser.uid,
                orderNumber: orderNumber,
                month: currentMonth,
                customerName,
                emailComprador: customerEmail,
                telefonoComprador: customerPhone,
                products,
                paymentMethod,
                paymentStatus: 'Pendiente',
                orderStatus: 'Pendiente',
                totalPrice,
                date: orderDate,
                deliveryDate, 
                createdAt: new Date().toISOString()
            });

            // 📧 ENVIAR EMAIL DE NUEVO PEDIDO
            if (customerEmail) {
                await sendNewOrderEmail({
                    customerName,
                    emailComprador: customerEmail,
                    products,
                    paymentStatus: 'Pendiente',
                    orderStatus: 'Pendiente',
                    totalPrice,
                    deliveryDate
                });
            }
        }

        // 📦 DESCONTAR INVENTARIO
        await deductInventoryForOrder(products);

        // ✅ CERRAR LOADING Y MOSTRAR ÉXITO
        Swal.fire({
            title: '¡Listo!',
            text: editingOrderId ? 'Pedido actualizado correctamente' : 'Pedido creado correctamente',
            icon: 'success',
            confirmButtonColor: '#667eea',
            timer: 2000
        });

        closeModal();
    } catch (error) {
        // ❌ CERRAR LOADING Y MOSTRAR ERROR
        console.error('Error:', error);
        Swal.fire({
            title: 'Error al guardar',
            text: error.message,
            icon: 'error',
            confirmButtonColor: '#667eea'
        });
    }
});

async function deleteOrder(orderId) {
    const result = await Swal.fire({
        title: '¿Eliminar este pedido?',
        text: 'Esta acción no se puede deshacer y devolverá los materiales al inventario',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#667eea',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        // Mostrar loading
        Swal.fire({
            title: 'Eliminando pedido...',
            text: 'Devolviendo materiales al inventario...',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const { deleteDoc, doc } = window.firestoreLib;
        try {
            // 🔙 Primero devolver materiales al inventario
            const order = orders.find(o => o.id === orderId);
            if (order && order.products) {
                await returnInventoryForOrder(order.products);
            }

            // 🗑️ Luego eliminar el pedido
            await deleteDoc(doc(window.db, 'orders', orderId));
            
            Swal.fire({
                title: '¡Eliminado!',
                text: 'El pedido ha sido eliminado y los materiales devueltos al inventario',
                icon: 'success',
                confirmButtonColor: '#667eea',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo eliminar el pedido: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#667eea'
            });
        }
    }
}

function renderOrders() {
    const ordersList = document.getElementById('ordersList');
    let monthOrders = orders.filter(o => o.month === currentMonth);

    monthOrders.sort((a, b) => {
        if (currentSortOption === 'date-asc') {
            return new Date(a.date) - new Date(b.date);
        } else if (currentSortOption === 'date-desc') {
            return new Date(b.date) - new Date(a.date);
        } else if (currentSortOption === 'delivery-asc') {
            const dateA = a.deliveryDate ? new Date(a.deliveryDate) : new Date('9999-12-31');
            const dateB = b.deliveryDate ? new Date(b.deliveryDate) : new Date('9999-12-31');
            return dateA - dateB;
        } else if (currentSortOption === 'delivery-desc') {
            const dateA = a.deliveryDate ? new Date(a.deliveryDate) : new Date('1900-01-01');
            const dateB = b.deliveryDate ? new Date(b.deliveryDate) : new Date('1900-01-01');
            return dateB - dateA;
        }
    });

    // 🆕 Separar pedidos activos de terminados
    const activeOrders = monthOrders.filter(o => !(o.paymentStatus === 'Pagado' && o.orderStatus === 'Entregado'));
    const completedOrders = monthOrders.filter(o => o.paymentStatus === 'Pagado' && o.orderStatus === 'Entregado');

    if (monthOrders.length === 0) {
        ordersList.innerHTML = '<div class="no-orders">No hay pedidos para este mes</div>';
        return;
    }

    let html = '';

    // 🆕 Sección de pedidos activos
    if (activeOrders.length > 0) {
        html += `
            <div class="orders-section">
                <h2 class="section-title">📦 Pedidos Activos (${activeOrders.length})</h2>
                <div class="orders-grid">
                    ${activeOrders.map(order => renderOrderCard(order)).join('')}
                </div>
            </div>
        `;
    }

    // 🆕 Sección de pedidos terminados (colapsable)
    if (completedOrders.length > 0) {
        html += `
            <div class="orders-section completed-section">
                <button class="section-toggle" onclick="toggleCompletedOrders()">
                    <span class="toggle-icon" id="completed-icon">▶</span>
                    <h2 class="section-title">✅ Pedidos Terminados (${completedOrders.length})</h2>
                </button>
                <div class="orders-grid collapsed" id="completedOrdersGrid">
                    ${completedOrders.map(order => renderOrderCard(order)).join('')}
                </div>
            </div>
        `;
    }

    if (activeOrders.length === 0 && completedOrders.length === 0) {
        html = '<div class="no-orders">No hay pedidos para este mes</div>';
    }

    ordersList.innerHTML = html;
}


function printOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const printInvoice = document.getElementById('printInvoice');
    
    // Usar la función auxiliar para llenar el template
    fillPrintTemplate(order);
    
    // Mostrar factura y ocultar el resto
    printInvoice.classList.remove('hidden');
    document.getElementById('mainApp').classList.add('print-hide');
    
    // Imprimir
    setTimeout(() => {
        window.print();
        
        // Restaurar después de imprimir
        const afterPrint = () => {
            printInvoice.classList.add('hidden');
            document.getElementById('mainApp').classList.remove('print-hide');
            window.removeEventListener('afterprint', afterPrint);
        };
        
        window.addEventListener('afterprint', afterPrint);
        
        // Fallback
        setTimeout(() => {
            if (!printInvoice.classList.contains('hidden')) {
                afterPrint();
            }
        }, 1000);
    }, 100);
}

// 🆕 Función auxiliar para renderizar una tarjeta de pedido
function renderOrderCard(order) {
    return `
        <div class="order-card">
        <input type="checkbox" class="order-checkbox" data-order-id="${order.id}" onchange="updateSelectedCount()">
        <div class="order-actions">
        <button class="edit-btn" onclick="openModal('${order.id}')">✏️ Editar</button>
        <button class="delete-btn" onclick="deleteOrder('${order.id}')">🗑️ Eliminar</button>
        <button class="print-btn" onclick="printOrder('${order.id}')">🖨️ Imprimir</button>
    </div>
            
            <div class="order-header">
                <h3>${order.customerName}</h3>
                ${order.orderNumber ? `<span class="order-number">Nº ${order.orderNumber}</span>` : ''}
                <span class="order-date">${order.date}</span>
                ${order.deliveryDate ? `<span class="order-date" style="color: #667eea;">📦 Entrega: ${order.deliveryDate}</span>` : ''}
            </div>
            
            <div class="order-details">
                ${order.emailComprador ? `
                <div class="detail-row">
                    <span class="detail-label">📧 Email:</span>
                    <span class="detail-value">${order.emailComprador}</span>
                </div>
                ` : ''}
                
                ${order.telefonoComprador ? `
                <div class="detail-row">
                    <span class="detail-label">📱 Teléfono:</span>
                    <span class="detail-value">${order.telefonoComprador}</span>
                </div>
                ` : ''}
                
                <div class="detail-row">
                    <span class="detail-label">Medio de Pago:</span>
                    <span class="detail-value">${order.paymentMethod}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Estado del Pago:</span>
                    <span class="detail-value">
                        <span class="status-badge ${
                            order.paymentStatus === 'Pagado' ? 'status-paid' :
                            order.paymentStatus === 'Senado' ? 'status-deposit' :
                            'status-pending'
                        }">
                            ${order.paymentStatus}
                        </span>                    
                    </span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Estado del Pedido:</span>
                    <span class="detail-value">
                        <span class="status-badge ${
                            order.orderStatus === 'Completado' || order.orderStatus === 'Entregado' ? 'status-completed' :
                            order.orderStatus === 'En Proceso' ? 'status-processing' : 'status-pending'
                        }">
                            ${order.orderStatus}
                        </span>
                    </span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Productos:</span>
                </div>
                <div class="products-collapsible">
                    <button class="toggle-products" onclick="toggleProducts('${order.id}')">
                        <span class="toggle-icon" id="icon-${order.id}">▶</span>
                        Ver Productos (${order.products.length})
                    </button>
                    <div class="product-list collapsed" id="products-${order.id}">
                        ${order.products.map((p, i) => `
                             <div class="product-list-item">
                                <strong>${p.name}</strong>${p.sheets ? ` (${p.sheets} hojas)` : ''}<br>
                                ${p.description ? `<strong>Descripción:</strong> ${p.description}<br>` : ''}
                                <strong>Color de anillado:</strong> ${p.color}<br>
                                ${p.stickerSheets ? `<strong>Cant. de planchas:</strong> ${p.stickerSheets}<br>` : ''}
                                ${p.coverText ? `<strong>Texto de tapa:</strong> ${p.coverText}<br>` : ''}
                                ${p.coverImage ? `<img src="${p.coverImage}" class="cover-image"><br>` : ''}
                                <strong>Precio:</strong> $${p.price.toFixed(2)}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="price-total">
                    Total: $${order.totalPrice.toFixed(2)}
                </div>
            </div>
        </div>
    `;
}

// 🆕 Función para toggle de pedidos terminados
function toggleCompletedOrders() {
    const grid = document.getElementById('completedOrdersGrid');
    const icon = document.getElementById('completed-icon');
    
    if (grid.classList.contains('collapsed')) {
        grid.classList.remove('collapsed');
        icon.textContent = '▼';
    } else {
        grid.classList.add('collapsed');
        icon.textContent = '▶';
    }
}

function toggleProducts(orderId) {
    const productList = document.getElementById(`products-${orderId}`);
    const icon = document.getElementById(`icon-${orderId}`);
    
    if (productList.classList.contains('collapsed')) {
        productList.classList.remove('collapsed');
        icon.textContent = '▼';
    } else {
        productList.classList.add('collapsed');
        icon.textContent = '▶';
    }
}

// Función para actualizar contador de seleccionados
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const count = checkboxes.length;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('downloadPdfBtn').disabled = count === 0;
}

// Función para generar PDF de múltiples pedidos
async function downloadSelectedPDF() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    
    if (checkboxes.length === 0) {
        Swal.fire({
            title: 'Sin selección',
            text: 'Por favor selecciona al menos un pedido',
            icon: 'warning',
            confirmButtonColor: '#667eea'
        });
        return;
    }

    // Mostrar loading
    Swal.fire({
        title: 'Generando PDF...',
        html: `Procesando ${checkboxes.length} pedido(s)...`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        let isFirstPage = true;

        for (const checkbox of checkboxes) {
            const orderId = checkbox.dataset.orderId;
            const order = orders.find(o => o.id === orderId);
            
            if (!order) continue;

            // Si no es la primera página, agregar nueva página
            if (!isFirstPage) {
                pdf.addPage();
            }
            isFirstPage = false;

            // Usar el mismo template de impresión
            fillPrintTemplate(order);
            
            // Obtener el elemento de impresión
            const printElement = document.getElementById('printInvoice');
            printElement.classList.remove('hidden');

            // Esperar a que las imágenes se carguen
            await new Promise(resolve => setTimeout(resolve, 100));

            // Convertir a canvas
            const canvas = await html2canvas(printElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 600,
                windowWidth: 600
            });

            // Ocultar el template
            printElement.classList.add('hidden');

            // Calcular dimensiones para A4
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Agregar imagen al PDF
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        }

        // Cerrar loading
        Swal.close();

       // Solo abrir en nueva pestaña (sin descargar automáticamente)
       const pdfBlob = pdf.output('blob');
       const url = URL.createObjectURL(pdfBlob);
       window.open(url, '_blank');

        // Desmarcar checkboxes
        checkboxes.forEach(cb => cb.checked = false);
        updateSelectedCount();

        Swal.fire({
            title: '¡PDF Generado!',
            text: `Se han procesado ${checkboxes.length} pedido(s)`,
            icon: 'success',
            confirmButtonColor: '#667eea',
            timer: 2000
        });

    } catch (error) {
        console.error('Error generando PDF:', error);
        Swal.fire({
            title: 'Error',
            text: 'Hubo un problema al generar el PDF: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#667eea'
        });
    }
}

// Función auxiliar para llenar el template de impresión (extraída de printOrder)
function fillPrintTemplate(order) {
    // Información del cliente
    document.getElementById('printCustomerName').textContent = order.customerName;
    document.getElementById('printCustomerEmail').textContent = order.emailComprador || 'No especificado';
    document.getElementById('printCustomerPhone').textContent = order.telefonoComprador || 'No especificado';
    
    // Fecha del pedido
    document.getElementById('printOrderDate').textContent = new Date(order.date).toLocaleDateString('es-AR');
    
    // Fecha estimada (solo si existe y es posterior a la fecha de pedido)
    const deliveryDateRow = document.getElementById('deliveryDateRow');
    if (order.deliveryDate && order.deliveryDate > order.date) {
        document.getElementById('printDeliveryDate').textContent = new Date(order.deliveryDate).toLocaleDateString('es-AR');
        deliveryDateRow.style.display = 'flex';
    } else {
        deliveryDateRow.style.display = 'none';
    }
    
    // Lista de productos
    const productsList = document.getElementById('printProductsList');
    productsList.innerHTML = order.products.map((p, i) => {
        let productHTML = `
            <div class="product-item">
                <div class="product-header">
                    <span class="product-number">${i + 1}.</span>
                    <span class="product-name">${p.name}</span>
                </div>
        `;
        
        // Descripción (si existe)
        if (p.description && p.description.trim() !== '') {
            productHTML += `<div class="product-desc">${p.description}</div>`;
        }
        
        // Color de anillado (solo si existe y no es vacío o "-")
        if (p.color && p.color.trim() !== '' && p.color.trim() !== '-') {
            productHTML += `<div class="product-detail">Color: ${p.color}</div>`;
        }
        
        // Texto de tapa (si existe)
        if (p.coverText && p.coverText.trim() !== '') {
            productHTML += `<div class="product-detail">Texto: ${p.coverText}</div>`;
        }
        
        productHTML += `
                <div class="product-price">$${p.price.toFixed(2)}</div>
            </div>
        `;
        
        return productHTML;
    }).join('');
    
    // Total
    document.getElementById('printTotal').textContent = '$' + order.totalPrice.toFixed(2);
}

// Cargar productos personalizados
function loadCustomProducts() {
    if (productsUnsubscribe) productsUnsubscribe();
    
    const { collection, query, where, onSnapshot } = window.firestoreLib;
    const q = query(
        collection(window.db, 'customProducts'),
        where('userId', '==', window.currentUser.uid)
    );

    productsUnsubscribe = onSnapshot(q, (snapshot) => {
        customProducts = [];
        snapshot.forEach((doc) => {
            customProducts.push({ id: doc.id, ...doc.data() });
        });
    });
}

// Obtener todos los productos (default + custom)
function getAllProducts() {
    const defaultProducts = [
        // { value: "Agenda diaria", label: "📅 Agenda diaria", type: 'default' },
        // { value: "Agenda 2 días x hoja", label: "📅 Agenda 2 días x hoja", type: 'default' },
        // { value: "Agenda semanal", label: "📅 Agenda semanal", type: 'default' },
        // { value: "Planner mensual 2026", label: "📆 Planner mensual 2026", type: 'default' },
        // { value: "Planner mensual perpetuo", label: "📆 Planner mensual perpetuo", type: 'default' },
        // { value: "Planner semanal perpetuo", label: "📆 Planner semanal perpetuo", type: 'default' },
        // { value: "Cuaderno anillado tapa dura", label: "📕 Cuaderno anillado tapa dura", type: 'default' },
        // { value: "Cuaderno tapa blanda abrochado", label: "📙 Cuaderno tapa blanda abrochado (hasta 60 hojas)", type: 'default' },
        // { value: "Agenda docente nivel sec/univ/sup", label: "👨‍🏫 Agenda docente nivel sec / univ / sup", type: 'default' },
        // { value: "Agenda docente nivel prim", label: "👩‍🏫 Agenda docente nivel prim", type: 'default' },
        // { value: "Agenda docente nivel inicial", label: "👶 Agenda docente nivel inicial", type: 'default' }
    ];
    
    const custom = customProducts.map(p => ({
        value: p.name,
        label: `${p.emoji || '📦'} ${p.name}`,
        type: 'custom'
    }));
    
    const recipes = productRecipes.map(p => ({
        value: p.name,
        label: `${p.emoji || '📦'} ${p.name}`,
        type: 'recipe',
        recipeId: p.id
    }));
    
    return [...defaultProducts, ...custom, ...recipes];
}

// Abrir modal de gestión de productos
function openProductsManager() {
    document.getElementById('productsModal').style.display = 'block';
    renderCustomProducts();
}

// Cerrar modal de gestión de productos
function closeProductsManager() {
    document.getElementById('productsModal').style.display = 'none';
    document.getElementById('addProductForm').reset();
}

// Renderizar lista de productos personalizados
function renderCustomProducts() {
    const container = document.getElementById('customProductsList');
    
    if (customProducts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No hay productos personalizados aún</p>';
        return;
    }
    
    container.innerHTML = customProducts.map(product => `
        <div class="custom-product-item">
            <span class="custom-product-name">${product.emoji || '📦'} ${product.name}</span>
            <button class="delete-custom-product" onclick="deleteCustomProduct('${product.id}')">🗑️ Eliminar</button>
        </div>
    `).join('');
}

// Agregar producto personalizado
document.getElementById('addProductForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('newProductName').value.trim();
    const emoji = document.getElementById('newProductEmoji').value.trim();
    
    if (!name) return;
    
    try {
        const { collection, addDoc } = window.firestoreLib;
        
        await addDoc(collection(window.db, 'customProducts'), {
            userId: window.currentUser.uid,
            name: name,
            emoji: emoji || '📦',
            createdAt: new Date().toISOString()
        });
        
        Swal.fire({
            title: '¡Producto agregado!',
            text: `"${name}" se agregó correctamente`,
            icon: 'success',
            confirmButtonColor: '#667eea',
            timer: 2000
        });
        
        document.getElementById('addProductForm').reset();
        renderCustomProducts();
        
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudo agregar el producto',
            icon: 'error',
            confirmButtonColor: '#667eea'
        });
    }
});

// Eliminar producto personalizado
async function deleteCustomProduct(productId) {
    const result = await Swal.fire({
        title: '¿Eliminar este producto?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#667eea',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { deleteDoc, doc } = window.firestoreLib;
            await deleteDoc(doc(window.db, 'customProducts', productId));
            
            Swal.fire({
                title: '¡Eliminado!',
                text: 'El producto ha sido eliminado',
                icon: 'success',
                confirmButtonColor: '#667eea',
                timer: 2000
            });
            
            renderCustomProducts();
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo eliminar el producto',
                icon: 'error',
                confirmButtonColor: '#667eea'
            });
        }
    }
}
// ========================================
// 📦 SISTEMA DE INVENTARIO
// ========================================

// Cargar materiales del inventario
function loadInventoryMaterials() {
    if (materialsUnsubscribe) materialsUnsubscribe();
    
    const { collection, query, where, onSnapshot } = window.firestoreLib;
    const q = query(
        collection(window.db, 'materials'),
        where('userId', '==', window.currentUser.uid)
    );

    materialsUnsubscribe = onSnapshot(q, (snapshot) => {
        inventoryMaterials = [];
        snapshot.forEach((doc) => {
            inventoryMaterials.push({ id: doc.id, ...doc.data() });
        });
        renderMaterialsGrid();
    });
}

// Cargar recetas de productos
function loadProductRecipes() {
    if (recipesUnsubscribe) recipesUnsubscribe();
    
    const { collection, query, where, onSnapshot } = window.firestoreLib;
    const q = query(
        collection(window.db, 'productRecipes'),
        where('userId', '==', window.currentUser.uid)
    );

    recipesUnsubscribe = onSnapshot(q, (snapshot) => {
        productRecipes = [];
        snapshot.forEach((doc) => {
            productRecipes.push({ id: doc.id, ...doc.data() });
        });
        renderRecipesList();
    });
}

// Abrir gestor de inventario
function openInventoryManager() {
    document.getElementById('inventoryModal').style.display = 'block';
    switchInventoryTab('materials');
    renderMaterialsGrid();
    renderRecipesList();
}

// Cerrar gestor de inventario
function closeInventoryManager() {
    document.getElementById('inventoryModal').style.display = 'none';
    document.getElementById('addMaterialForm').reset();
    document.getElementById('addRecipeForm').reset();
    document.getElementById('recipeMaterialsContainer').innerHTML = '';
    recipeMaterialCounter = 0;
}

// Cambiar entre tabs
function switchInventoryTab(tab) {
    const tabs = document.querySelectorAll('.inventory-tab');
    const contents = document.querySelectorAll('.inventory-tab-content');
    
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    
    if (tab === 'materials') {
        tabs[0].classList.add('active');
        document.getElementById('materialsTab').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('recipesTab').classList.add('active');
    }
}

// Renderizar grid de materiales
function renderMaterialsGrid() {
    const container = document.getElementById('materialsGrid');

    if (inventoryMaterials.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px; grid-column: 1/-1;">No hay materiales en el inventario</p>';
        return;
    }

    container.innerHTML = inventoryMaterials.map(material => {
        const currentStock = Number(material.stock);

        let stockBadge = '';
        let lowStockClass = '';

        if (currentStock === 0) {
            stockBadge = '<span class="no-stock-badge">❌ Sin Stock</span>';
            lowStockClass = 'no-stock'; // Clase para resaltar toda la tarjeta
        } else if (currentStock < 10) {
            stockBadge = '<span class="low-stock-badge">⚠️ Stock Bajo</span>';
            lowStockClass = 'low-stock'; // Clase para resaltar toda la tarjeta
        }

        return `
            <div class="material-card ${lowStockClass}">
                <div class="material-header">
                    <h4>${material.name}</h4>
                    ${stockBadge}
                </div>
                <div class="material-stock">
                    <span class="stock-number">${material.stock}</span>
                    <span class="stock-unit">${material.unit}</span>
                </div>
                <div class="material-actions">
                    <button onclick="adjustStock('${material.id}', 'add')" class="stock-btn add">+ Agregar</button>
                    <button onclick="adjustStock('${material.id}', 'remove')" class="stock-btn remove">- Quitar</button>
                    <button onclick="deleteMaterial('${material.id}')" class="stock-btn delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// Ajustar stock de material
async function adjustStock(materialId, action) {
    const material = inventoryMaterials.find(m => m.id === materialId);
    if (!material) return;
    
    const { value: amount } = await Swal.fire({
        title: `${action === 'add' ? 'Agregar' : 'Quitar'} Stock`,
        html: `
            <p><strong>${material.name}</strong></p>
            <p>Stock actual: ${material.stock} ${material.unit}</p>
        `,
        input: 'number',
        inputLabel: `Cantidad a ${action === 'add' ? 'agregar' : 'quitar'}`,
        inputPlaceholder: '0',
        inputAttributes: {
            min: 0,
            step: 1
        },
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Confirmar',
        inputValidator: (value) => {
            if (!value || value <= 0) {
                return 'Ingresa una cantidad válida';
            }
            if (action === 'remove' && parseInt(value) > material.stock) {
                return 'No hay suficiente stock';
            }
        }
    });
    
    if (amount) {
        const newStock = action === 'add' 
            ? material.stock + parseInt(amount)
            : material.stock - parseInt(amount);
        
        try {
            const { updateDoc, doc } = window.firestoreLib;
            await updateDoc(doc(window.db, 'materials', materialId), {
                stock: newStock
            });
            
            Swal.fire({
                title: '¡Actualizado!',
                text: `Nuevo stock: ${newStock} ${material.unit}`,
                icon: 'success',
                confirmButtonColor: '#667eea',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo actualizar el stock',
                icon: 'error',
                confirmButtonColor: '#667eea'
            });
        }
    }
}

// Eliminar material
async function deleteMaterial(materialId) {
    const result = await Swal.fire({
        title: '¿Eliminar este material?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#667eea',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { deleteDoc, doc } = window.firestoreLib;
            await deleteDoc(doc(window.db, 'materials', materialId));
            
            Swal.fire({
                title: '¡Eliminado!',
                icon: 'success',
                confirmButtonColor: '#667eea',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo eliminar el material',
                icon: 'error',
                confirmButtonColor: '#667eea'
            });
        }
    }
}

// Agregar nuevo material
document.getElementById('addMaterialForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('newMaterialName').value.trim();
    const stock = parseInt(document.getElementById('newMaterialStock').value);
    const unit = document.getElementById('newMaterialUnit').value.trim();
    
    try {
        const { collection, addDoc } = window.firestoreLib;
        
        await addDoc(collection(window.db, 'materials'), {
            userId: window.currentUser.uid,   // 🔥 Necesario por las rules
            name: name,
            stock: stock,
            unit: unit,
            minStock: 10,
            createdAt: new Date().toISOString()
        });
        
        Swal.fire({
            title: '¡Material agregado!',
            icon: 'success',
            confirmButtonColor: '#667eea',
            timer: 2000
        });
        
        document.getElementById('addMaterialForm').reset();
    } catch (error) {
        Swal.fire({
            title: 'Error',
            text: 'No se pudo agregar el material: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#667eea'
        });
    }
});

// Renderizar lista de recetas
function renderRecipesList() {
    const container = document.getElementById('recipesList');
    
    if (productRecipes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No hay productos con receta definida</p>';
        return;
    }
    
    container.innerHTML = productRecipes.map(recipe => `
        <div class="recipe-card">
            <div class="recipe-header">
                <h4>${recipe.emoji || '📦'} ${recipe.name}</h4>
                <button onclick="deleteRecipe('${recipe.id}')" class="delete-recipe-btn">🗑️</button>
            </div>
            <div class="recipe-materials">
                <strong>Materiales necesarios:</strong>
                <ul>
                    ${recipe.materials.map(m => `
                        <li>${m.quantity} ${m.unit} de ${m.materialName}</li>
                    `).join('')}
                </ul>
            </div>
            <div class="recipe-stock-info">
                ${getRecipeStockStatus(recipe)}
            </div>
        </div>
    `).join('');
}

// Verificar si hay stock suficiente para un producto
function getRecipeStockStatus(recipe) {
    let canMake = Infinity;
    let warnings = [];
    
    recipe.materials.forEach(recMat => {
        const material = inventoryMaterials.find(m => m.id === recMat.materialId);
        if (!material) {
            warnings.push(`⚠️ Material "${recMat.materialName}" no encontrado`);
            canMake = 0;
        } else {
            const possible = Math.floor(material.stock / recMat.quantity);
            canMake = Math.min(canMake, possible);
        }
    });
    
    if (warnings.length > 0) {
        return `<span class="stock-warning">${warnings.join('<br>')}</span>`;
    }
    
    if (canMake === 0) {
        return '<span class="stock-error">❌ Sin stock suficiente</span>';
    } else if (canMake < 5) {
        return `<span class="stock-warning">⚠️ Puedes hacer ${canMake} unidades</span>`;
    } else {
        return `<span class="stock-ok">✅ Puedes hacer ${canMake} unidades</span>`;
    }
}

// Agregar material a la receta
function addRecipeMaterial() {
    recipeMaterialCounter++;
    const container = document.getElementById('recipeMaterialsContainer');
    const div = document.createElement('div');
    div.className = 'recipe-material-item';
    div.id = `recipe-material-${recipeMaterialCounter}`;
    
    div.innerHTML = `
        <select class="recipe-material-select" required>
            <option value="">Seleccionar material...</option>
            ${inventoryMaterials.map(m => `
                <option value="${m.id}" data-unit="${m.unit}">${m.name} (${m.stock} ${m.unit} disponibles)</option>
            `).join('')}
        </select>
        <input type="number" class="recipe-material-quantity" placeholder="Cantidad" min="0.01" step="0.01" required>
        <span class="recipe-material-unit"></span>
        <button type="button" class="remove-recipe-material" onclick="removeRecipeMaterial(${recipeMaterialCounter})">×</button>
    `;
    
    container.appendChild(div);
    
    // Listener para actualizar la unidad
    const select = div.querySelector('.recipe-material-select');
    const unitSpan = div.querySelector('.recipe-material-unit');
    select.addEventListener('change', function() {
        const option = this.options[this.selectedIndex];
        const unit = option.dataset.unit || '';
        unitSpan.textContent = unit;
    });
}

// Quitar material de la receta
function removeRecipeMaterial(id) {
    const element = document.getElementById(`recipe-material-${id}`);
    if (element) element.remove();
}

// Crear nueva receta de producto
document.getElementById('addRecipeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('newRecipeName').value.trim();
    const emoji = document.getElementById('newRecipeEmoji').value.trim();
    
    const materialItems = document.querySelectorAll('.recipe-material-item');
    if (materialItems.length === 0) {
        Swal.fire({
            title: 'Sin materiales',
            text: 'Debes agregar al menos un material',
            icon: 'warning',
            confirmButtonColor: '#667eea'
        });
        return;
    }
    
    const materials = [];
    materialItems.forEach(item => {
        const select = item.querySelector('.recipe-material-select');
        const quantity = parseFloat(item.querySelector('.recipe-material-quantity').value);
        const materialId = select.value;
        const materialName = select.options[select.selectedIndex].text.split(' (')[0];
        const unit = select.options[select.selectedIndex].dataset.unit;
        
        materials.push({
            materialId,
            materialName,
            quantity,
            unit
        });
    });
    
    try {
        const { collection, addDoc } = window.firestoreLib;
        
        await addDoc(collection(window.db, 'productRecipes'), {
            userId: window.currentUser.uid,
            name: name,
            emoji: emoji || '📦',
            materials: materials,
            createdAt: new Date().toISOString()
        });
        
        Swal.fire({
            title: '¡Producto creado!',
            text: 'La receta fue guardada correctamente',
            icon: 'success',
            confirmButtonColor: '#667eea',
            timer: 2000
        });
        
        document.getElementById('addRecipeForm').reset();
        document.getElementById('recipeMaterialsContainer').innerHTML = '';
        recipeMaterialCounter = 0;
    } catch (error) {
        Swal.fire({
            title: 'Error',
            text: 'No se pudo crear el producto',
            icon: 'error',
            confirmButtonColor: '#667eea'
        });
    }
});

// Eliminar receta
async function deleteRecipe(recipeId) {
    const result = await Swal.fire({
        title: '¿Eliminar este producto?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#667eea',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { deleteDoc, doc } = window.firestoreLib;
            await deleteDoc(doc(window.db, 'productRecipes', recipeId));
            
            Swal.fire({
                title: '¡Eliminado!',
                icon: 'success',
                confirmButtonColor: '#667eea',
                timer: 2000
            });
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo eliminar el producto',
                icon: 'error',
                confirmButtonColor: '#667eea'
            });
        }
    }
}

// ========================================
// 🔄 MODIFICAR getAllProducts() para incluir productos con receta
// ========================================

// Descontar inventario al crear/editar pedido
async function deductInventoryForOrder(products) {
    const { updateDoc, doc } = window.firestoreLib;
    const deductions = {};
    
    console.log('🔍 Iniciando deducción de inventario para productos:', products);
    
    // Calcular total a descontar por material
    for (const product of products) {
        console.log('📦 Procesando producto:', product.name);
        
        // 🎯 SI EL PRODUCTO CONTIENE "STICKER" → DESCONTAR PLANCHAS DEL MATERIAL ESPECÍFICO
        const esSticker = product.name.toLowerCase().includes('sticker');
        
        if (esSticker && product.stickerSheets && parseInt(product.stickerSheets) > 0) {
            const cantidad = parseInt(product.stickerSheets);
            const productNameLower = product.name.toLowerCase();
            
            console.log(`🎨 Es un sticker: "${product.name}", buscando material específico...`);
            
            // 🔍 Buscar material ESPECÍFICO basado en el nombre del producto
            let stickerMaterial = null;
            
            // Buscar por palabras clave en el NOMBRE DEL PRODUCTO
            if (productNameLower.includes('holofan')) {
                stickerMaterial = inventoryMaterials.find(m => 
                    m.name.toLowerCase().includes('holofan')
                );
                console.log('🔍 Buscando HOLOFAN...');
            } else if (productNameLower.includes('vinilo')) {
                stickerMaterial = inventoryMaterials.find(m => 
                    m.name.toLowerCase().includes('vinilo')
                );
                console.log('🔍 Buscando VINILO...');
            } else if (productNameLower.includes('autoadhesivo') || productNameLower.includes('autoadesivo')) {
                stickerMaterial = inventoryMaterials.find(m => {
                    const nameLower = m.name.toLowerCase();
                    return nameLower.includes('papel autoadhesivo') || 
                           nameLower.includes('autoadesivo');
                });
                console.log('🔍 Buscando PAPEL AUTOADHESIVO...');
            } else {
                // Si no tiene palabra clave específica, buscar cualquier material de sticker
                stickerMaterial = inventoryMaterials.find(m => {
                    const nameLower = m.name.toLowerCase();
                    return nameLower.includes('holofan') || 
                           nameLower.includes('vinilo') ||
                           nameLower.includes('papel autoadhesivo') ||
                           nameLower.includes('autoadesivo');
                });
                console.log('🔍 Buscando cualquier material de sticker...');
            }
            
            if (stickerMaterial) {
                if (!deductions[stickerMaterial.id]) {
                    deductions[stickerMaterial.id] = 0;
                }
                deductions[stickerMaterial.id] += cantidad;
                console.log(`  ✅ Deduciendo ${cantidad} ${stickerMaterial.unit} de ${stickerMaterial.name}`);
            } else {
                console.warn('⚠️ NO se encontró material de stickers para:', product.name);
                console.log('📋 Materiales disponibles:', inventoryMaterials.map(m => m.name));
                
                Swal.fire({
                    title: 'Aviso',
                    html: `No se encontró material de stickers para "${product.name}".<br><br>
                           <strong>Asegúrate de incluir:</strong> "holofan", "vinilo" o "autoadhesivo" en el nombre del producto`,
                    icon: 'warning',
                    confirmButtonColor: '#667eea'
                });
            }
            
            // ⚠️ IMPORTANTE: Saltar la parte de la receta
            continue;
        }
        
        // 📋 CASO NORMAL: Productos SIN "sticker" en el nombre → Usar receta
        const recipe = productRecipes.find(r => r.name === product.name);
        if (recipe) {
            console.log('📋 Producto tiene receta:', recipe.name);
            recipe.materials.forEach(mat => {
                if (!deductions[mat.materialId]) {
                    deductions[mat.materialId] = 0;
                }
                deductions[mat.materialId] += mat.quantity;
                console.log(`  ✅ Deduciendo ${mat.quantity} ${mat.unit} de ${mat.materialName}`);
            });
        }
    }
    
    // Aplicar deducciones
    console.log('💾 Aplicando deducciones:', deductions);
    
    const promises = Object.entries(deductions).map(async ([materialId, amount]) => {
        const material = inventoryMaterials.find(m => m.id === materialId);
        if (material) {
            const newStock = Math.max(0, material.stock - amount);
            await updateDoc(doc(window.db, 'materials', materialId), {
                stock: newStock
            });
            console.log(`✅ ${material.name}: ${material.stock} → ${newStock} (descontado ${amount})`);
            
            // Alerta si el stock quedó bajo
            if (newStock <= (material.minStock || 10) && material.stock > (material.minStock || 10)) {
                Swal.fire({
                    title: '⚠️ Stock Bajo',
                    text: `El material "${material.name}" ahora tiene solo ${newStock} ${material.unit}`,
                    icon: 'warning',
                    confirmButtonColor: '#667eea',
                    timer: 3000
                });
            }
        }
    });
    
    await Promise.all(promises);
    console.log('✅ Inventario actualizado correctamente');
}

// 🔙 Nueva función para DEVOLVER inventario al eliminar pedido
async function returnInventoryForOrder(products) {
    const { updateDoc, doc } = window.firestoreLib;
    const returns = {};
    
    console.log('🔙 Iniciando devolución de inventario para productos:', products);
    
    // Calcular total a devolver por material (MISMA LÓGICA QUE deductInventoryForOrder)
    for (const product of products) {
        console.log('📦 Procesando producto:', product.name);
        
        // 🎯 SI EL PRODUCTO CONTIENE "STICKER" → DEVOLVER PLANCHAS
        const esSticker = product.name.toLowerCase().includes('sticker');
        
        if (esSticker && product.stickerSheets && parseInt(product.stickerSheets) > 0) {
            const cantidad = parseInt(product.stickerSheets);
            console.log(`🎨 Es un sticker, devolviendo ${cantidad} planchas`);
            
            // Buscar materiales de sticker
            const stickerMaterial = inventoryMaterials.find(m => {
                const nameLower = m.name.toLowerCase();
                return nameLower.includes('holofan') || 
                       nameLower.includes('vinilo') ||
                       nameLower.includes('papel autoadhesivo') ||
                       nameLower.includes('autoadesivo');
            });
            
            if (stickerMaterial) {
                if (!returns[stickerMaterial.id]) {
                    returns[stickerMaterial.id] = 0;
                }
                returns[stickerMaterial.id] += cantidad;
                console.log(`  ✅ Devolviendo ${cantidad} ${stickerMaterial.unit} de ${stickerMaterial.name}`);
            }
            
            continue;
        }
        
        // 📋 CASO NORMAL: Productos con receta
        const recipe = productRecipes.find(r => r.name === product.name);
        if (recipe) {
            console.log('📋 Producto tiene receta:', recipe.name);
            recipe.materials.forEach(mat => {
                if (!returns[mat.materialId]) {
                    returns[mat.materialId] = 0;
                }
                returns[mat.materialId] += mat.quantity;
                console.log(`  ✅ Devolviendo ${mat.quantity} ${mat.unit} de ${mat.materialName}`);
            });
        }
    }
    
    // Aplicar devoluciones
    console.log('💾 Aplicando devoluciones:', returns);
    
    const promises = Object.entries(returns).map(async ([materialId, amount]) => {
        const material = inventoryMaterials.find(m => m.id === materialId);
        if (material) {
            const newStock = material.stock + amount;
            await updateDoc(doc(window.db, 'materials', materialId), {
                stock: newStock
            });
            console.log(`✅ ${material.name}: ${material.stock} → ${newStock} (devuelto ${amount})`);
        }
    });
    
    await Promise.all(promises);
    console.log('✅ Inventario devuelto correctamente');
}