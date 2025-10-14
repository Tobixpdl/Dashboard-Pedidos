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
    { id: 'oct-2026', name: 'Octubre 2026', visible: true }
];

let orders = [];
let currentMonth = null;
let productCounter = 0;
let currentSortOption = 'date-asc';
let unsubscribe = null;

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
            <input type="text" class="product-name" required placeholder="Ej: Cuaderno A4" value="${productData?.name || ''}">
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
            await addDoc(collection(window.db, 'orders'), {
                userId: window.currentUser.uid,
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

    if (monthOrders.length === 0) {
        ordersList.innerHTML = '<div class="no-orders">No hay pedidos para este mes</div>';
        return;
    }

    ordersList.innerHTML = monthOrders.map(order => `
        <div class="order-card">
            <div class="order-actions">
                <button class="edit-btn" onclick="openModal('${order.id}')">✏️ Editar</button>
                <button class="delete-btn" onclick="deleteOrder('${order.id}')">🗑️ Eliminar</button>
            </div>
            
            <div class="order-header">
                <h3>${order.customerName}</h3>
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
                        <span class="status-badge ${order.paymentStatus === 'Pagado' ? 'status-paid' : 'status-pending'}">
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
                                <strong>${p.name}</strong><br>
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
    `).join('');

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