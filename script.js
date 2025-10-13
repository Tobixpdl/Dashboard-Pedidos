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
        document.getElementById('paymentStatusGroup').style.display = 'block';
        document.getElementById('orderStatusGroup').style.display = 'block';
        
        const order = orders.find(o => o.id === orderId);
        if (order) {
            document.getElementById('modalTitle').textContent = 'Editar Pedido';
            document.getElementById('submitBtn').textContent = 'Actualizar Pedido';
            document.getElementById('editingOrderId').value = orderId;
            document.getElementById('customerName').value = order.customerName;
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
        document.getElementById('paymentStatusGroup').style.display = 'none';
        document.getElementById('orderStatusGroup').style.display = 'none';
        
        document.getElementById('modalTitle').textContent = 'Nuevo Pedido';
        document.getElementById('submitBtn').textContent = 'Guardar Pedido';
        document.getElementById('editingOrderId').value = '';
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
    const orderDate = document.getElementById('orderDate').value;
    const deliveryDate = document.getElementById('deliveryDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const paymentStatus = document.getElementById('paymentStatus').value;
    const orderStatus = document.getElementById('orderStatus').value;

    const products = [];
    const productItems = document.querySelectorAll('.product-item');
    let allImagesLoaded = 0;
    const totalImages = document.querySelectorAll('.product-cover').length;
    
    const processOrder = async () => {
        if (allImagesLoaded === totalImages) {
            const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
            const { collection, addDoc, updateDoc, doc } = window.firestoreLib;

            try {
                if (editingOrderId) {
                    const orderRef = doc(window.db, 'orders', editingOrderId);
                    await updateDoc(orderRef, {
                        customerName,
                        products,
                        paymentMethod,
                        paymentStatus,
                        orderStatus,
                        totalPrice,
                        date: orderDate,
                        deliveryDate,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    await addDoc(collection(window.db, 'orders'), {
                        userId: window.currentUser.uid,
                        month: currentMonth,
                        customerName,
                        products,
                        paymentMethod,
                        paymentStatus: 'Pendiente',
                        orderStatus: 'Pendiente',
                        totalPrice,
                        date: orderDate,
                        deliveryDate, 
                        createdAt: new Date().toISOString()
                    });
                }

                closeModal();
            } catch (error) {
                alert('Error al guardar: ' + error.message);
            }
        }
    };

    productItems.forEach(item => {
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
                products.push({
                    name,
                    description,
                    color,
                    coverImage: e.target.result,
                    coverText,
                    price
                });
                allImagesLoaded++;
                processOrder();
            };
            reader.readAsDataURL(coverInput.files[0]);
        } else {
            products.push({
                name,
                description,
                color,
                coverImage: existingCoverImage || null,
                coverText,
                price
            });
            allImagesLoaded++;
            processOrder();
        }
    });
});

async function deleteOrder(orderId) {
    if (confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
        const { deleteDoc, doc } = window.firestoreLib;
        try {
            await deleteDoc(doc(window.db, 'orders', orderId));
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
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
                                <strong>Precio:</strong> ${p.price.toFixed(2)}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="price-total">
                    Total: ${order.totalPrice.toFixed(2)}
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