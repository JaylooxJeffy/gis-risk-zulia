// ============================================================================
// PANEL DE ANALISTA — GIS RISK ZULIA
// Muestra los análisis guardados por el analista con sus notas, factores,
// nivel de riesgo y validación científica. Permite editar notas y eliminar.
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
    inicializarPanel();
});

async function inicializarPanel() {
    const valido = await ApiClient.validateSession();
    if (!valido) { window.location.href = 'auth.html'; return; }

    const user = ApiClient.getUser();
    if (!user || (user.rol !== 'analista' && user.rol !== 'administrador')) {
        window.location.href = 'sig-zulia-pro.html';
        return;
    }

    document.getElementById('analista-username').textContent = user.username;
    cargarUbicaciones();
}

async function cargarUbicaciones() {
    const contenedor = document.getElementById('ubicaciones-container');
    const empty = document.getElementById('empty-ubicaciones');
    contenedor.innerHTML = '<p style="color:#94a3b8;padding:20px;">Cargando análisis guardados...</p>';

    const response = await ApiClient.listarUbicaciones();
    if (!response.success) {
        contenedor.innerHTML = '<p style="color:#dc2626;padding:20px;">Error al cargar los análisis. Intenta de nuevo.</p>';
        return;
    }

    const ubicaciones = response.ubicaciones || [];
    document.getElementById('badge-ubicaciones').textContent = ubicaciones.length;

    if (ubicaciones.length === 0) {
        contenedor.innerHTML = '';
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    contenedor.innerHTML = ubicaciones.map(u => renderTarjeta(u)).join('');
}

function renderTarjeta(u) {
    const factores = Array.isArray(u.factores) ? u.factores : (typeof u.factores === 'string' ? JSON.parse(u.factores) : []);
    const validacion = u.validacion ? (typeof u.validacion === 'string' ? JSON.parse(u.validacion) : u.validacion) : null;

    const factoresHtml = factores.length > 0
        ? '<div class="card-factores">' +
          factores.map(f => '<span class="factor-tag ' + (f.level === 'high' ? 'alto' : '') + '">' + (f.name || f.nombre || '') + '</span>').join('') +
          '</div>'
        : '<p style="font-size:0.82em;color:#94a3b8;">Sin factores registrados</p>';

    const validacionHtml = validacion && validacion.validados && validacion.validados.length > 0
        ? '<div class="validacion-mini">' +
          '<div class="validacion-mini-titulo">🔬 Validación Científica' + (validacion.porcentaje !== null && validacion.porcentaje !== undefined ? ' — ' + validacion.porcentaje + '% coincidencia' : '') + '</div>' +
          validacion.validados.map(v => {
              const iconos = { coincide: '✅', parcial: '⚠️', no_coincide: '❌', sin_datos: '➖' };
              return '<div class="v-item">' + (iconos[v.veredicto] || '➖') + ' <strong>' + v.nombre + '</strong>: ' + v.detalle + '</div>';
          }).join('') +
          '</div>'
        : '';

    const fecha = new Date(u.fecha_guardado).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return '<div class="solicitud-card" id="card-' + u.id + '">' +
        '<div class="card-header">' +
        '<div>' +
        '<h3 class="card-title">📍 ' + u.nombre + '</h3>' +
        '<div class="card-coordenadas">' + u.lat + 'N, ' + Math.abs(u.lng) + 'W' + (u.municipio ? ' · ' + u.municipio : '') + '</div>' +
        '</div>' +
        '<span class="riesgo-badge" style="background:' + (u.color_riesgo || '#64748b') + ';">' + (u.nivel_riesgo || 'N/D') + '</span>' +
        '</div>' +
        '<div class="card-body">' +
        '<p style="font-size:0.82em;font-weight:600;color:#475569;margin-bottom:6px;">Factores detectados (' + factores.length + ')</p>' +
        factoresHtml +
        (u.recomendacion ? '<p style="font-size:0.82em;color:#92400e;background:#fef3c7;padding:8px 10px;border-radius:8px;margin:10px 0;">' + u.recomendacion + '</p>' : '') +
        validacionHtml +
        '<div style="margin-top:14px;">' +
        '<label class="notas-label">📝 Notas del analista</label>' +
        '<textarea class="notas-area" id="notas-' + u.id + '">' + (u.notas || '') + '</textarea>' +
        '</div>' +
        '<div class="card-actions">' +
        '<button class="btn-guardar-notas" onclick="guardarNotas(' + u.id + ')">Guardar Notas</button>' +
        '<button class="btn-eliminar-ubi" onclick="eliminarUbicacion(' + u.id + ', \'' + u.nombre.replace(/'/g, "\\'") + '\')">🗑️ Eliminar</button>' +
        '</div>' +
        '<div class="card-fecha">Guardado el ' + fecha + '</div>' +
        '</div>' +
        '</div>';
}

async function guardarNotas(id) {
    const textarea = document.getElementById('notas-' + id);
    if (!textarea) return;
    const notas = textarea.value;

    const btn = textarea.closest('.card-body').querySelector('.btn-guardar-notas');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const response = await ApiClient.actualizarNotas(id, notas);
    if (response.success) {
        btn.textContent = '✅ Guardado';
        setTimeout(() => { btn.textContent = 'Guardar Notas'; btn.disabled = false; }, 2500);
    } else {
        btn.textContent = 'Error';
        btn.disabled = false;
    }
}

async function eliminarUbicacion(id, nombre) {
    if (!confirm('¿Eliminar el análisis de "' + nombre + '"? Esta acción no se puede deshacer.')) return;

    const response = await ApiClient.eliminarUbicacion(id);
    if (response.success) {
        const card = document.getElementById('card-' + id);
        if (card) card.remove();
        const restantes = document.querySelectorAll('.solicitud-card').length;
        document.getElementById('badge-ubicaciones').textContent = restantes;
        if (restantes === 0) document.getElementById('empty-ubicaciones').style.display = 'flex';
    } else {
        alert('No se pudo eliminar. Intenta de nuevo.');
    }
}

function handleLogout() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        ApiClient.logout();
    }
}

window.cargarUbicaciones = cargarUbicaciones;
window.guardarNotas = guardarNotas;
window.eliminarUbicacion = eliminarUbicacion;
window.handleLogout = handleLogout;
