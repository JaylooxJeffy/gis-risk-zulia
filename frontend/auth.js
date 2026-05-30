// ============================================================================
// LÓGICA DE AUTENTICACIÓN - GIS RISK ZULIA
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    initAuth();
});

function initAuth() {
    if (ApiClient.isAuthenticated()) {
        const user = ApiClient.getUser();
        if (user) {
            redirectByRole(user.rol);
            return;
        }
    }

    setupTabs();
    setupUserTypeSelector();
    setupForms();
}

// ========== TABS ==========
function setupTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const containers = document.querySelectorAll('.auth-form-container');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            containers.forEach(c => c.classList.remove('active'));
            document.getElementById(tabName + '-container').classList.add('active');
        });
    });
}

// ========== SELECTOR DE TIPO DE USUARIO ==========
function setupUserTypeSelector() {
    const typeBtns = document.querySelectorAll('.user-type-btn');
    const consultorForm = document.getElementById('register-consultor-form');
    const specialForm = document.getElementById('register-special-form');
    const completeForm = document.getElementById('complete-registration-form');
    const rolInput = document.getElementById('reg-special-rol');

    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (type === 'consultor') {
                consultorForm.classList.add('active');
                specialForm.classList.remove('active');
                completeForm.style.display = 'none';
            } else {
                consultorForm.classList.remove('active');
                specialForm.classList.add('active');
                completeForm.style.display = 'none';
                rolInput.value = type;
            }
        });
    });
}

// ========== FORMULARIOS ==========
function setupForms() {
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);

    const consultorForm = document.getElementById('register-consultor-form');
    consultorForm.addEventListener('submit', handleRegistroConsultor);

    const specialForm = document.getElementById('register-special-form');
    specialForm.addEventListener('submit', handleSolicitudRegistro);

    const completeForm = document.getElementById('complete-registration-form');
    completeForm.addEventListener('submit', handleCompletarRegistro);

    const btnBack = document.getElementById('btn-back-to-solicitud');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            document.getElementById('complete-registration-form').style.display = 'none';
            document.getElementById('register-special-form').classList.add('active');
        });
    }
}

// ========== MANEJADORES ==========
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const messageEl = document.getElementById('login-message');

    try {
        showMessage(messageEl, 'Iniciando sesión...', 'info');

        const response = await ApiClient.login(email, password);

        if (response.success) {
            // Múltiples cuentas — mostrar selector
            if (response.multiplesCuentas) {
                mostrarSelectorCuentas(email, password, response.cuentas, messageEl);
                return;
            }

            if (response.token) ApiClient.saveToken(response.token);
            if (response.usuario) ApiClient.saveUser(response.usuario);

            showMessage(messageEl, 'Inicio de sesión exitoso. Redirigiendo...', 'success');
            setTimeout(() => { redirectByRole(response.usuario.rol); }, 1000);
        } else {
            showMessage(messageEl, response.message || 'Error al iniciar sesión', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage(messageEl, 'Error de conexión. Verifica que el servidor esté corriendo.', 'error');
    }
}

async function handleRegistroConsultor(e) {
    e.preventDefault();

    const username = document.getElementById('reg-consultor-username').value;
    const email = document.getElementById('reg-consultor-email').value;
    const password = document.getElementById('reg-consultor-password').value;
    const messageEl = document.getElementById('register-consultor-message');

    try {
        showMessage(messageEl, 'Registrando...', 'info');

        const response = await ApiClient.registroConsultor(username, email, password);

        if (response.success) {
            if (response.token) ApiClient.saveToken(response.token);
            if (response.usuario) ApiClient.saveUser(response.usuario);

            let mensaje = 'Registro exitoso. Redirigiendo...';
            if (response.fueModificado) {
                mensaje = `Registro exitoso. Tu nombre de usuario fue asignado como: ${response.usernameAsignado}`;
            }
            showMessage(messageEl, mensaje, 'success');

            setTimeout(() => { redirectByRole('consultor'); }, 2000);
        } else {
            showMessage(messageEl, response.message || 'Error al registrar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage(messageEl, 'Error de conexión', 'error');
    }
}

async function handleSolicitudRegistro(e) {
    e.preventDefault();

    const username = document.getElementById('reg-special-username').value;
    const email = document.getElementById('reg-special-email').value;
    const rol = document.getElementById('reg-special-rol').value;
    const messageEl = document.getElementById('register-special-message');

    try {
        showMessage(messageEl, 'Enviando solicitud...', 'info');

        const response = await ApiClient.solicitarRegistro(username, email, rol);

        if (response.success) {
            showMessage(messageEl, 'Solicitud enviada. Recibirás un código por email si es aprobada.', 'success');

            setTimeout(() => {
                document.getElementById('register-special-form').classList.remove('active');
                document.getElementById('complete-registration-form').style.display = 'block';
            }, 2000);
        } else {
            showMessage(messageEl, response.message || 'Error al enviar solicitud', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage(messageEl, 'Error de conexión', 'error');
    }
}

async function handleCompletarRegistro(e) {
    e.preventDefault();

    const email = document.getElementById('complete-email').value;
    const codigo = document.getElementById('complete-code').value;
    const password = document.getElementById('complete-password').value;
    const messageEl = document.getElementById('complete-registration-message');

    try {
        showMessage(messageEl, 'Verificando código...', 'info');

        const response = await ApiClient.completarRegistro(email, codigo, password);

        if (response.success) {
            showMessage(messageEl, 'Registro completado. Iniciando sesión...', 'success');

            setTimeout(() => {
                redirectByRole(response.usuario.rol);
            }, 1500);
        } else {
            showMessage(messageEl, response.message || 'Código inválido o expirado', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage(messageEl, 'Error de conexión', 'error');
    }
}

// ========== SELECTOR DE CUENTAS MÚLTIPLES ==========
function mostrarSelectorCuentas(email, password, cuentas, messageEl) {
    const roleIcons = { consultor: '👤', analista: '📊', administrador: '⚙️' };
    const roleLabels = { consultor: 'Consultor', analista: 'Analista', administrador: 'Administrador' };

    const selectorHtml = `
        <div style="margin-top:15px; background:#f8fafc; padding:15px; border-radius:10px; border:1px solid #e2e8f0;">
            <p style="font-weight:600; color:#1a365d; margin-bottom:12px;">Tienes varias cuentas. ¿Con cuál deseas entrar?</p>
            ${cuentas.map(cuenta => `
                <button onclick="seleccionarCuenta('${email}', '${password}', ${cuenta.id})"
                    style="display:flex; align-items:center; gap:10px; width:100%; padding:10px 14px; margin-bottom:8px; background:white; border:2px solid #e2e8f0; border-radius:8px; cursor:pointer; transition:all 0.2s; font-size:14px; font-weight:500;">
                    <span style="font-size:20px;">${roleIcons[cuenta.rol]}</span>
                    <div style="text-align:left;">
                        <div style="color:#1e293b; font-weight:600;">${cuenta.username}</div>
                        <div style="color:#64748b; font-size:12px;">${roleLabels[cuenta.rol]}</div>
                    </div>
                </button>
            `).join('')}
        </div>
    `;

    messageEl.innerHTML = selectorHtml;
    messageEl.className = 'message info show';
    messageEl.style.display = 'block';
}

async function seleccionarCuenta(email, password, userId) {
    const messageEl = document.getElementById('login-message');
    try {
        showMessage(messageEl, 'Iniciando sesión...', 'info');
        const response = await ApiClient.loginConCuenta(email, password, userId);
        if (response.success) {
            if (response.token) ApiClient.saveToken(response.token);
            if (response.usuario) ApiClient.saveUser(response.usuario);
            showMessage(messageEl, 'Inicio de sesión exitoso. Redirigiendo...', 'success');
            setTimeout(() => { redirectByRole(response.usuario.rol); }, 1000);
        } else {
            showMessage(messageEl, response.message || 'Error al iniciar sesión', 'error');
        }
    } catch (error) {
        showMessage(messageEl, 'Error de conexión', 'error');
    }
}

window.seleccionarCuenta = seleccionarCuenta;

// ========== AUXILIARES ==========
function redirectByRole(rol) {
    const user = ApiClient.getUser();
    if (user && user.password_temporal === true) {
        window.location.href = 'change-password.html';
        return;
    }
    window.location.href = 'sig-zulia-pro.html';
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = 'message ' + type + ' show';
    element.style.display = 'block';
}

function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = '';
        element.className = 'message';
        element.style.display = 'none';
    }
}
