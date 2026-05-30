// ============================================================================
// ADMIN PANEL - GIS RISK ZULIA
// Lógica del panel de administración
// ============================================================================

let solicitudActual = null;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    initAdminPanel();
});

async function initAdminPanel() {
    const sessionValid = await ApiClient.validateSession();
    if (!sessionValid) {
        window.location.href = 'auth.html';
        return;
    }

    const user = ApiClient.getUser();
    if (!user || user.rol !== 'administrador') {
        alert('Acceso denegado. Solo administradores pueden acceder a este panel.');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('admin-username').textContent = user.username;
    setupNavigation();
    await cargarMisPermisos();
    cargarSolicitudesPendientes();
    actualizarBadgePendientes();
    setupModalButtons();
}

// ========== NAVEGACIÓN ==========
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const sectionName = item.dataset.section;
            if (!sectionName) return; // Para el enlace "Ir al Sistema GIS" - deja que el href funcione
            
            e.preventDefault();
            
            // Actualizar items activos
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Mostrar sección correspondiente
            const sections = document.querySelectorAll('.content-section');
            sections.forEach(section => section.classList.remove('active'));
            document.getElementById('section-' + sectionName).classList.add('active');
            
            // Cargar datos de la sección
            if (sectionName === 'solicitudes') {
                cargarSolicitudesPendientes();
            } else if (sectionName === 'historial') {
                cargarHistorialSolicitudes();
            } else if (sectionName === 'usuarios') {
                cargarUsuarios();
            }
        });
    });
}

// ========== SOLICITUDES PENDIENTES ==========
async function cargarSolicitudesPendientes() {
    const container = document.getElementById('solicitudes-container');
    const emptyState = document.getElementById('empty-state');
    
    container.innerHTML = '<div class="loading"></div>';
    
    try {
        const response = await ApiClient.listarSolicitudesPendientes();
        
        if (response.success && response.solicitudes) {
            if (response.solicitudes.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'flex';
            } else {
                emptyState.style.display = 'none';
                container.innerHTML = response.solicitudes.map(solicitud => crearCardSolicitud(solicitud)).join('');
            }
        } else {
            container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error al cargar solicitudes</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error de conexión</p>';
    }
    
    actualizarBadgePendientes();
}

function crearCardSolicitud(solicitud) {
    const fecha = new Date(solicitud.fecha_solicitud).toLocaleDateString('es-ES');
    const badgeClass = solicitud.rol_solicitado === 'administrador' ? 'badge-administrador' : 'badge-analista';
    
    return `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${solicitud.nombre_usuario}</div>
                    <div class="card-subtitle">${solicitud.email}</div>
                </div>
                <span class="card-badge ${badgeClass}">${solicitud.rol_solicitado}</span>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <div class="info-row">
                        <span class="info-label">Fecha:</span>
                        <span class="info-value">${fecha}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Estado:</span>
                        <span class="info-value">
                            <span class="card-badge badge-pendiente">Pendiente</span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn-card btn-approve" onclick="abrirModalAprobar(${solicitud.id}, '${solicitud.nombre_usuario}', '${solicitud.email}', '${solicitud.rol_solicitado}')">
                    Aprobar
                </button>
                <button class="btn-card btn-reject" onclick="abrirModalRechazar(${solicitud.id}, '${solicitud.nombre_usuario}', '${solicitud.email}')">
                    Rechazar
                </button>
            </div>
        </div>
    `;
}

async function actualizarBadgePendientes() {
    try {
        const response = await ApiClient.contarSolicitudesPendientes();
        if (response.success && response.count !== undefined) {
            document.getElementById('badge-pendientes').textContent = response.count;
        }
    } catch (error) {
        console.error('Error al actualizar badge:', error);
    }
}

// ========== HISTORIAL DE SOLICITUDES ==========
async function cargarHistorialSolicitudes() {
    const container = document.getElementById('historial-container');
    
    container.innerHTML = '<div class="loading"></div>';
    
    try {
        const response = await ApiClient.listarTodasSolicitudes();
        
        if (response.success && response.solicitudes) {
            container.innerHTML = response.solicitudes.map(solicitud => crearCardHistorial(solicitud)).join('');
        } else {
            container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error al cargar historial</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error de conexión</p>';
    }
}

function crearCardHistorial(solicitud) {
    const fecha = new Date(solicitud.fecha_solicitud).toLocaleDateString('es-ES');
    const estadoBadgeClass = 
        solicitud.estado === 'aprobada' ? 'badge-aprobada' :
        solicitud.estado === 'rechazada' ? 'badge-rechazada' : 'badge-pendiente';
    const rolBadgeClass = solicitud.rol_solicitado === 'administrador' ? 'badge-administrador' : 'badge-analista';
    
    return `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${solicitud.nombre_usuario}</div>
                    <div class="card-subtitle">${solicitud.email}</div>
                </div>
                <span class="card-badge ${rolBadgeClass}">${solicitud.rol_solicitado}</span>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <div class="info-row">
                        <span class="info-label">Fecha:</span>
                        <span class="info-value">${fecha}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Estado:</span>
                        <span class="info-value">
                            <span class="card-badge ${estadoBadgeClass}">${solicitud.estado}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========== PERMISOS ==========
let misPermisos = { esPrincipal: false, puedeAprobar: false };

async function cargarMisPermisos() {
    try {
        const response = await ApiClient.obtenerMisPermisos();
        if (response.success) {
            misPermisos = response;
        }
    } catch (error) {
        console.error('Error al cargar permisos:', error);
    }
}

// ========== GESTIÓN DE USUARIOS ==========
async function cargarUsuarios() {
    const container = document.getElementById('usuarios-container');
    
    container.innerHTML = '<div class="loading"></div>';
    
    try {
        const response = await ApiClient.listarUsuarios();
        
        if (response.success && response.usuarios) {
            container.innerHTML = response.usuarios.map(usuario => crearCardUsuario(usuario)).join('');
        } else {
            container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error al cargar usuarios</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p style="color: var(--danger); text-align: center;">Error de conexión</p>';
    }
}

function crearCardUsuario(usuario) {
    const fecha = new Date(usuario.fecha_creacion).toLocaleDateString('es-ES');
    const rolBadgeClass = 
        usuario.rol === 'administrador' ? 'badge-administrador' :
        usuario.rol === 'analista' ? 'badge-analista' : 'badge-consultor';
    
    const estadoBadge = usuario.activo 
        ? '<span class="card-badge badge-aprobada">Activo</span>'
        : '<span class="card-badge badge-rechazada">Inactivo</span>';
    
    const delegadoBadge = usuario.rol === 'administrador' && usuario.delegado
        ? '<span class="card-badge badge-aprobada" style="margin-left:6px;">Delegado</span>'
        : '';

    const delegacionBtn = misPermisos.esPrincipal && usuario.rol === 'administrador' && usuario.email !== 'jeffersonrosales2014@gmail.com'
        ? usuario.delegado
            ? `<button class="btn-card btn-deactivate" onclick="quitarDelegacion(${usuario.id})">Quitar Delegación</button>`
            : `<button class="btn-card btn-activate" onclick="darDelegacion(${usuario.id})">Dar Delegación</button>`
        : '';

    const actionButton = usuario.activo
        ? `<button class="btn-card btn-deactivate" onclick="desactivarUsuario(${usuario.id})">Desactivar</button>`
        : `<button class="btn-card btn-activate" onclick="activarUsuario(${usuario.id})">Activar</button>`;

    return `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${usuario.username} ${delegadoBadge}</div>
                    <div class="card-subtitle">${usuario.email}</div>
                </div>
                <span class="card-badge ${rolBadgeClass}">${usuario.rol}</span>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <div class="info-row">
                        <span class="info-label">ID:</span>
                        <span class="info-value">#${usuario.id}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Creado:</span>
                        <span class="info-value">${fecha}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Estado:</span>
                        <span class="info-value">${estadoBadge}</span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                ${actionButton}
                ${delegacionBtn}
            </div>
        </div>
    `;
}

async function desactivarUsuario(id) {
    if (!confirm('¿Estás seguro de desactivar este usuario?')) return;
    
    try {
        const response = await ApiClient.desactivarUsuario(id);
        if (response.success) {
            alert('Usuario desactivado correctamente');
            cargarUsuarios();
        } else {
            alert('Error al desactivar usuario: ' + (response.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function activarUsuario(id) {
    if (!confirm('¿Estás seguro de activar este usuario?')) return;
    
    try {
        const response = await ApiClient.activarUsuario(id);
        if (response.success) {
            alert('Usuario activado correctamente');
            cargarUsuarios();
        } else {
            alert('Error al activar usuario: ' + (response.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

// ========== MODALES ==========
function setupModalButtons() {
    document.getElementById('btn-confirmar-aprobar').addEventListener('click', confirmarAprobar);
    document.getElementById('btn-confirmar-rechazar').addEventListener('click', confirmarRechazar);
}

function abrirModalAprobar(id, nombre, email, rol) {
    solicitudActual = { id, nombre, email, rol };
    
    document.getElementById('aprobar-info').innerHTML = `
        <div><strong>Nombre:</strong> ${nombre}</div>
        <div><strong>Email:</strong> ${email}</div>
        <div><strong>Rol:</strong> ${rol}</div>
    `;
    
    document.getElementById('modal-aprobar').classList.add('active');
}

function abrirModalRechazar(id, nombre, email) {
    solicitudActual = { id, nombre, email };
    
    document.getElementById('rechazar-info').innerHTML = `
        <div><strong>Nombre:</strong> ${nombre}</div>
        <div><strong>Email:</strong> ${email}</div>
    `;
    
    document.getElementById('modal-rechazar').classList.add('active');
}

function cerrarModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    solicitudActual = null;
}

async function confirmarAprobar() {
    if (!solicitudActual) return;
    
    try {
        const response = await ApiClient.aprobarSolicitud(solicitudActual.id);
        
        if (response.success) {
            alert('Solicitud aprobada. Se ha enviado el código de acceso por email.');
            cerrarModal('modal-aprobar');
            cargarSolicitudesPendientes();
        } else {
            alert('Error al aprobar solicitud: ' + (response.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function confirmarRechazar() {
    if (!solicitudActual) return;
    
    try {
        const response = await ApiClient.rechazarSolicitud(solicitudActual.id);
        
        if (response.success) {
            alert('Solicitud rechazada. Se ha enviado notificación por email.');
            cerrarModal('modal-rechazar');
            cargarSolicitudesPendientes();
        } else {
            alert('Error al rechazar solicitud: ' + (response.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function darDelegacion(id) {
    if (!confirm('¿Dar permisos de aprobación a este administrador?')) return;
    try {
        const response = await ApiClient.delegarAdmin(id);
        if (response.success) {
            alert('Delegación otorgada correctamente');
            cargarUsuarios();
        } else {
            alert('Error: ' + (response.message || response.error || 'Error desconocido'));
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

async function quitarDelegacion(id) {
    if (!confirm('¿Quitar permisos de aprobación a este administrador?')) return;
    try {
        const response = await ApiClient.quitarDelegacionAdmin(id);
        if (response.success) {
            alert('Delegación removida correctamente');
            cargarUsuarios();
        } else {
            alert('Error: ' + (response.message || response.error || 'Error desconocido'));
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

// ========== LOGOUT ==========
function handleLogout() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        ApiClient.logout();
    }
}

// Hacer funciones globales para uso en onclick
window.darDelegacion = darDelegacion;
window.quitarDelegacion = quitarDelegacion;
window.cargarSolicitudesPendientes = cargarSolicitudesPendientes;
window.cargarHistorialSolicitudes = cargarHistorialSolicitudes;
window.cargarUsuarios = cargarUsuarios;
window.abrirModalAprobar = abrirModalAprobar;
window.abrirModalRechazar = abrirModalRechazar;
window.cerrarModal = cerrarModal;
window.desactivarUsuario = desactivarUsuario;
window.activarUsuario = activarUsuario;
window.handleLogout = handleLogout;
