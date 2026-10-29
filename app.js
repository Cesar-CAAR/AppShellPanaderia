const apiURL = 'https://panaderiaapi-e9ll.onrender.com/api/productos';
const bannerRed = document.getElementById('estado-red');
let productosActuales = []; 
let productoAEliminarId = null; 

// ==========================================
// 1. CARGA DE PRODUCTOS
// ==========================================
async function cargarProductos() {
    let productosBase = [];
    
    try {
        const respuesta = await fetch(apiURL);
        productosBase = await respuesta.json();
        localStorage.setItem('productosCache', JSON.stringify(productosBase));
    } catch (error) {
        console.error('Modo Offline:', error);
        productosBase = JSON.parse(localStorage.getItem('productosCache')) || [];
    }

    const cola = JSON.parse(localStorage.getItem('colaOperaciones')) || [];
    const creadosLocalmente = cola.filter(op => op.metodo === 'POST').map(op => op.datos);
    
    productosActuales = [...productosBase, ...creadosLocalmente];
    renderizarCatalogo(productosActuales);
}

function renderizarCatalogo(productos) {
    const contenedor = document.getElementById('catalogo');
    contenedor.innerHTML = ''; 
    
    productos.forEach(producto => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta';
        const idRender = producto.id || producto.tempId; 
        const esLocal = !producto.id; 
        
        tarjeta.onclick = () => abrirDetalles(idRender);

        tarjeta.innerHTML = `
            <h2>${producto.nombre}</h2>
            <p class="precio">$${producto.precio.toFixed(2)}</p>
            <p class="texto-secundario">${producto.descripcion.substring(0, 50)}...</p>
            ${esLocal ? '<p style="color:red; font-size:12px;">(Guardado sin conexión)</p>' : ''}
        `;
        contenedor.appendChild(tarjeta);
    });
}

// ==========================================
// 2. CONTROL DE MODALES
// ==========================================
window.cerrarModal = function(idModal) {
    document.getElementById(idModal).classList.add('oculto');
}

function mostrarAlertaModal(mensaje) {
    document.getElementById('alerta-mensaje').textContent = mensaje;
    document.getElementById('modal-alerta').classList.remove('oculto');
}

window.abrirDetalles = function(id) {
    const producto = productosActuales.find(p => p.id == id || p.tempId == id);
    if (!producto) return;

    document.getElementById('detalle-nombre').textContent = producto.nombre;
    document.getElementById('detalle-descripcion').textContent = producto.descripcion;
    document.getElementById('detalle-precio').textContent = `$${producto.precio.toFixed(2)}`;
    document.getElementById('detalle-temperatura').textContent = producto.temperaturaHorneado;
    
    const ingredientes = producto.ingredientes || [];
    document.getElementById('detalle-ingredientes').innerHTML = ingredientes.length > 0 
        ? ingredientes.map(i => `<li>${i.cantidad} ${i.unidadMedida} de ${i.nombre}</li>`).join('')
        : '<li>Sin ingredientes registrados</li>';

    document.getElementById('btn-detalle-editar').onclick = () => abrirModalEditar(id);
    document.getElementById('btn-detalle-eliminar').onclick = () => confirmarEliminacion(id);

    document.getElementById('modal-detalles').classList.remove('oculto');
}

window.abrirModalCrear = function() {
    document.getElementById('form-producto').reset();
    document.getElementById('form-id').value = ''; 
    document.getElementById('form-titulo').textContent = 'Crear Nuevo Producto';
    document.getElementById('modal-formulario').classList.remove('oculto');
}

window.abrirModalEditar = function(id) {
    cerrarModal('modal-detalles'); 
    const producto = productosActuales.find(p => p.id == id || p.tempId == id);
    
    document.getElementById('form-id').value = producto.id || producto.tempId;
    document.getElementById('form-nombre').value = producto.nombre;
    document.getElementById('form-descripcion').value = producto.descripcion;
    document.getElementById('form-precio').value = producto.precio;
    document.getElementById('form-temperatura').value = producto.temperaturaHorneado;
    
    const ingredientes = producto.ingredientes || [];
    const textoIngredientes = ingredientes.map(i => `${i.cantidad} ${i.unidadMedida} ${i.nombre}`).join('\n');
    document.getElementById('form-ingredientes').value = textoIngredientes;
    
    document.getElementById('form-titulo').textContent = 'Editar Producto';
    document.getElementById('modal-formulario').classList.remove('oculto');
}

// ==========================================
// 3. PROCESAR FORMULARIO (POST / PUT)
// ==========================================
document.getElementById('form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idFormulario = document.getElementById('form-id').value;
    
    const lineasIngredientes = document.getElementById('form-ingredientes').value.split('\n');
    const arregloIngredientes = lineasIngredientes
        .filter(linea => linea.trim() !== '')
        .map(linea => {
            const partes = linea.trim().split(' ');
            return {
                cantidad: parseFloat(partes[0]) || 1,
                unidadMedida: partes[1] || 'pza',
                nombre: partes.slice(2).join(' ') || linea
            };
        });
    
    const productoDatos = {
        nombre: document.getElementById('form-nombre').value,
        descripcion: document.getElementById('form-descripcion').value,
        precio: parseFloat(document.getElementById('form-precio').value),
        temperaturaHorneado: document.getElementById('form-temperatura').value,
        ingredientes: arregloIngredientes
    };

    cerrarModal('modal-formulario');

    if (!idFormulario) {
        productoDatos.tempId = Date.now().toString();
        await gestionarAccion('POST', apiURL, productoDatos);
    } else {
        productoDatos.id = parseInt(idFormulario);
        await gestionarAccion('PUT', `${apiURL}/${idFormulario}`, productoDatos);
    }
});

// ==========================================
// 4. ELIMINACIÓN Y OFFLINE
// ==========================================
window.confirmarEliminacion = function(id) {
    cerrarModal('modal-detalles'); 
    productoAEliminarId = id; 
    document.getElementById('modal-confirmacion').classList.remove('oculto'); 
}

document.getElementById('btn-confirmar-eliminar').addEventListener('click', async () => {
    if (productoAEliminarId !== null) {
        cerrarModal('modal-confirmacion');
        await gestionarAccion('DELETE', `${apiURL}/${productoAEliminarId}`);
        productoAEliminarId = null; 
    }
});

async function gestionarAccion(metodo, url, datos = null) {
    if (navigator.onLine) {
        try {
            const opciones = { method: metodo, headers: { 'Content-Type': 'application/json' } };
            if (datos) opciones.body = JSON.stringify(datos);
            await fetch(url, opciones);
            cargarProductos(); 
        } catch (error) {
            encolarOperacion(metodo, url, datos);
        }
    } else {
        encolarOperacion(metodo, url, datos);
        cargarProductos(); 
    }
}

function encolarOperacion(metodo, url, datos) {
    let cola = JSON.parse(localStorage.getItem('colaOperaciones')) || [];
    cola.push({ metodo, url, datos });
    localStorage.setItem('colaOperaciones', JSON.stringify(cola));
    mostrarAlertaModal('Sin conexión: Operación guardada localmente en la cola.');
}

async function sincronizarPendientes() {
    let cola = JSON.parse(localStorage.getItem('colaOperaciones')) || [];
    if (cola.length === 0) return;
    for (let op of cola) {
        const opciones = { method: op.metodo, headers: { 'Content-Type': 'application/json' } };
        if (op.datos) opciones.body = JSON.stringify(op.datos);
        try { await fetch(op.url, opciones); } catch (e) { return; }
    }
    localStorage.removeItem('colaOperaciones');
    cargarProductos();
    mostrarAlertaModal('¡Sincronización completada con éxito!');
}

window.addEventListener('online', () => {
    mostrarEstadoRed('Conectado - Sincronizando...', 'online');
    sincronizarPendientes();
    setTimeout(() => { if (bannerRed) bannerRed.classList.add('oculto'); }, 3000);
});
window.addEventListener('offline', () => mostrarEstadoRed('Sin conexión - Modo local', 'offline'));

function mostrarEstadoRed(mensaje, clase) {
    if (bannerRed) {
        bannerRed.textContent = mensaje;
        bannerRed.className = clase;
        bannerRed.classList.remove('oculto');
    }
}

cargarProductos();