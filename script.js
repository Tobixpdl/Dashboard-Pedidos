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
                <option value="Agenda diaria" ${productData?.name === 'Agenda diaria' ? 'selected' : ''}>📅 Agenda diaria</option>
                <option value="Agenda 2 días x hoja" ${productData?.name === 'Agenda 2 días x hoja' ? 'selected' : ''}>📅 Agenda 2 días x hoja</option>
                <option value="Agenda semanal" ${productData?.name === 'Agenda semanal' ? 'selected' : ''}>📅 Agenda semanal</option>
                <option value="Planner mensual 2026" ${productData?.name === 'Planner mensual 2026' ? 'selected' : ''}>📆 Planner mensual 2026</option>
                <option value="Planner mensual perpetuo" ${productData?.name === 'Planner mensual perpetuo' ? 'selected' : ''}>📆 Planner mensual perpetuo</option>
                <option value="Planner semanal perpetuo" ${productData?.name === 'Planner semanal perpetuo' ? 'selected' : ''}>📆 Planner semanal perpetuo</option>
                <option value="Cuaderno anillado tapa dura" ${productData?.name === 'Cuaderno anillado tapa dura' ? 'selected' : ''}>📓 Cuaderno anillado tapa dura</option>
                <option value="Cuaderno tapa blanda abrochado" ${productData?.name === 'Cuaderno tapa blanda abrochado' ? 'selected' : ''}>📒 Cuaderno tapa blanda abrochado (hasta 60 hojas)</option>
                <option value="Agenda docente nivel sec/univ/sup" ${productData?.name === 'Agenda docente nivel sec/univ/sup' ? 'selected' : ''}>👨‍🏫 Agenda docente nivel sec / univ / sup</option>
                <option value="Agenda docente nivel prim" ${productData?.name === 'Agenda docente nivel prim' ? 'selected' : ''}>👩‍🏫 Agenda docente nivel prim</option>
                <option value="Agenda docente nivel inicial" ${productData?.name === 'Agenda docente nivel inicial' ? 'selected' : ''}>👶 Agenda docente nivel inicial</option>
            </select>
        </div>

        <div class="form-group product-sheets-group" id="sheets-group-${productCounter}" style="display: none;">
            <label>Cantidad de Hojas *</label>
            <input type="number" class="product-sheets" min="1" value="${productData?.sheets || ''}" placeholder="Ej: 80">
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
                        price
                    });
                };
                reader.readAsDataURL(coverInput.files[0]);
            } else {
                resolve({
                    name,
                    sheets,
                    description,
                    color,
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
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#667eea',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        const { deleteDoc, doc } = window.firestoreLib;
        try {
            await deleteDoc(doc(window.db, 'orders', orderId));
            Swal.fire({
                title: '¡Eliminado!',
                text: 'El pedido ha sido eliminado correctamente',
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