// ============================================================================
// LÓGICA DE AUTENTICACIÓN - GIS RISK ZULIA
// Manejo de formularios de login y registro
// VERSIÓN CORREGIDA - Redirige a sig-zulia-pro.html
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    initAuth();
});

function initAuth() {
    // Verificar si ya está autenticado
    if (ApiClient.isAuthenticated()) {
        const user = ApiClient.getUser();
        if (user) {
            // Redirigir según el rol
            redirectByRole(user.rol);
            return;
        }
    }

    setupTabs();
    setupUserTypeSelector();
    setupForms();
    setupQuickLoginButtons(); // NUEVO: Botones de login rápido
}

// ========== CONFIGURAR TABS ==========
function setupTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const containers = document.querySelectorAll('.auth-form-container');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Actualizar tabs activos
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Actualizar contenedores activos
            containers.forEach(c => c.classList.remove('active'));
            document.getElementById(tabName + '-container').classList.add('active');
        });
    });
}

// ========== CONFIGURAR SELECTOR DE TIPO DE USUARIO ==========
function setupUserTypeSelector() {
    const typeBtns = document.querySelectorAll('.user-type-btn');
    const consultorForm = document.getElementById('register-consultor-form');
    const specialForm = document.getElementById('register-special-form');
    const completeForm = document.getElementById('complete-registration-form');
    const rolInput = document.getElementById('reg-special-rol');

    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;

            // Actualizar botones activos
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Mostrar formulario correspondiente
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

// ========== NUEVO: BOTONES DE LOGIN RÁPIDO PARA TESTING ==========
function setupQuickLoginButtons() {
    // Buscar el contenedor de login
    const loginContainer = document.getElementById('login-container');
    if (!loginContainer) return;

    // Crear sección de login rápido
    const quickLoginSection = document.createElement('div');
    quickLoginSection.style.cssText = `
        margin-top: 20px;
        padding-top: 20px;
        border-top: 2px solid #e2e8f0;
    `;
    quickLoginSection.innerHTML = `
        <p style="text-align: center; color: #64748b; font-size: 0.9em; margin-bottom: 12px;">
            🚀 Acceso rápido para testing:
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" class="quick-login-btn consultor-btn" onclick="quickLogin('consultor')">
                👤 Login como Consultor
            </button>
            <button type="button" class="quick-login-btn analista-btn" onclick="quickLogin('analista')">
                📊 Login como Analista
            </button>
            <button type="button" class="quick-login-btn admin-btn" onclick="quickLogin('administrador')">
                ⚙️ Login como Administrador
            </button>
        </div>
    `;

    // Insertar después del formulario de login
    const loginForm = document.getElementById('login-form');
    if (loginForm && loginForm.parentElement) {
        loginForm.parentElement.appendChild(quickLoginSection);
    }

    // Agregar estilos para los botones
    addQuickLoginStyles();
}

function addQuickLoginStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .quick-login-btn {
            padding: 12px 20px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 0.9em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            background: white;
        }
        
        .consultor-btn {
            color: #2563eb;
            border-color: #2563eb;
        }
        
        .consultor-btn:hover {
            background: #2563eb;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        .analista-btn {
            color: #7c3aed;
            border-color: #7c3aed;
        }
        
        .analista-btn:hover {
            background: #7c3aed;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }
        
        .admin-btn {
            color: #dc2626;
            border-color: #dc2626;
        }
        
        .admin-btn:hover {
            background: #dc2626;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }
    `;
    document.head.appendChild(style);
}

// ========== FUNCIÓN DE LOGIN RÁPIDO ==========
function quickLogin(role) {
    // Simular usuario según el rol
    // IMPORTANTE: En producción, esto debe usar credenciales reales
    const credentials = {
        'consultor': {
            email: 'consultor@test.com',
            password: 'test123'
        },
        'analista': {
            email: 'analista@test.com',
            password: 'test123'
        },
        'administrador': {
            email: 'jeffersonrosales2014@gmail.com',
            password: 'Jayloox'
        }
    };

    const cred = credentials[role];
    if (!cred) {
        alert('Rol no válido');
        return;
    }

    // Llenar el formulario y hacer login
    document.getElementById('login-email').value = cred.email;
    document.getElementById('login-password').value = cred.password;
    
    // Hacer login automáticamente
    const loginForm = document.getElementById('login-form');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    loginForm.dispatchEvent(event);
}

// ========== CONFIGURAR FORMULARIOS ==========
function setupForms() {
    // Formulario de login
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);

    // Formulario de registro consultor
    const consultorForm = document.getElementById('register-consultor-form');
    consultorForm.addEventListener('submit', handleRegistroConsultor);

    // Formulario de solicitud (analista/admin)
    const specialForm = document.getElementById('register-special-form');
    specialForm.addEventListener('submit', handleSolicitudRegistro);

    // Formulario de completar registro
    const completeForm = document.getElementById('complete-registration-form');
    completeForm.addEventListener('submit', handleCompletarRegistro);

    // Botón volver a solicitud
    const btnBack = document.getElementById('btn-back-to-solicitud');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            document.getElementById('complete-registration-form').style.display = 'none';
            document.getElementById('register-special-form').classList.add('active');
        });
    }
}

// ========== MANEJADORES DE FORMULARIOS ==========

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const messageEl = document.getElementById('login-message');

    try {
        showMessage(messageEl, 'Iniciando sesión...', 'info');
        
        const response = await ApiClient.login(email, password);
        
        if (response.success) {
            if (response.token) {
                ApiClient.saveToken(response.token);
            }
            if (response.usuario) {
                ApiClient.saveUser(response.usuario);
            }
            
            showMessage(messageEl, '¡Inicio de sesión exitoso! Redirigiendo...', 'success');
            
            setTimeout(() => {
                redirectByRole(response.usuario.rol);
            }, 1000);
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
            if (response.token) {
                ApiClient.saveToken(response.token);
            }
            if (response.usuario) {
                ApiClient.saveUser(response.usuario);
            }
            
            showMessage(messageEl, '¡Registro exitoso! Redirigiendo...', 'success');
            
            setTimeout(() => {
                redirectByRole('consultor');
            }, 1500);
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
            showMessage(messageEl, '¡Registro completado! Iniciando sesión...', 'success');
            
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

// ========== FUNCIONES AUXILIARES ==========

// ✅ CORREGIDO: TODOS van a sig-zulia-pro.html
function redirectByRole(rol) {
    sessionStorage.setItem('userRole', rol);
    
    // Verificar si la contraseña es temporal
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

// Hacer quickLogin global
window.quickLogin = quickLogin;