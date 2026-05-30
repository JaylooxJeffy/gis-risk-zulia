let recoveryToken = null;
let recoveryQuestions = [];

document.addEventListener('DOMContentLoaded', function() {
    setupRecoveryListeners();
});

function setupRecoveryListeners() {
    const btnForgot = document.getElementById('btn-forgot-credentials');
    if (btnForgot) {
        btnForgot.addEventListener('click', showRecoveryForm);
    }

    const btnBackLogin = document.getElementById('btn-back-to-login');
    if (btnBackLogin) {
        btnBackLogin.addEventListener('click', showLoginForm);
    }

    const btnBackRecovery = document.getElementById('btn-back-to-recovery');
    if (btnBackRecovery) {
        btnBackRecovery.addEventListener('click', showRecoverySearchForm);
    }

    const btnBackLoginSuccess = document.getElementById('btn-back-to-login-success');
    if (btnBackLoginSuccess) {
        btnBackLoginSuccess.addEventListener('click', showLoginForm);
    }

    const recoveryForm = document.getElementById('recovery-form');
    if (recoveryForm) {
        recoveryForm.addEventListener('submit', handleRecoverySearch);
    }

    const verifyForm = document.getElementById('verify-identity-form');
    if (verifyForm) {
        verifyForm.addEventListener('submit', handleVerifyIdentity);
    }
}

function showRecoveryForm() {
    document.getElementById('login-container').classList.remove('active');
    document.getElementById('register-container').classList.remove('active');
    document.getElementById('recovery-container').classList.add('active');
    
    document.getElementById('recovery-form').reset();
    document.getElementById('recovery-form').style.display = 'block';
    document.getElementById('verify-identity-form').style.display = 'none';
    document.getElementById('recovery-success').style.display = 'none';
    clearMessage('recovery-message');
}

function showLoginForm() {
    document.getElementById('recovery-container').classList.remove('active');
    document.getElementById('login-container').classList.add('active');
    clearMessage('login-message');
}

function showRecoverySearchForm() {
    document.getElementById('verify-identity-form').style.display = 'none';
    document.getElementById('recovery-form').style.display = 'block';
    clearMessage('recovery-message');
    clearMessage('verify-message');
}

async function handleRecoverySearch(e) {
    e.preventDefault();
    
    const email = document.getElementById('recovery-email').value.trim();
    const messageEl = document.getElementById('recovery-message');
    
    if (!email) {
        showMessage(messageEl, 'Por favor ingresa tu correo electrónico', 'error');
        return;
    }

    if (!validateEmail(email)) {
        showMessage(messageEl, 'Por favor ingresa un correo electrónico válido', 'error');
        return;
    }

    try {
        showMessage(messageEl, 'Enviando solicitud de recuperación...', 'info');
        
        const response = await fetch('http://localhost:3000/api/recovery/solicitar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            showMessage(messageEl, 
                data.message || 'Se ha enviado una contraseña temporal a tu email.', 
                'success');
            
            // Después de 3 segundos, volver al login
            setTimeout(() => {
                showLoginForm();
            }, 3000);
        } else {
            showMessage(messageEl, 
                data.error || 'Error al procesar la solicitud.', 
                'error');
        }

    } catch (error) {
        console.error('Error en recuperación:', error);
        showMessage(messageEl, 'Error al procesar la solicitud. Intenta nuevamente.', 'error');
    }
}

function renderVerificationQuestions(preguntas) {
    const container = document.getElementById('identity-questions');
    container.innerHTML = '';

    preguntas.forEach(function(pregunta, index) {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = (index + 1) + '. ' + pregunta.pregunta;
        questionDiv.appendChild(label);

        if (pregunta.tipo === 'texto') {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'pregunta-' + pregunta.id;
            input.required = true;
            input.placeholder = 'Tu respuesta...';
            questionDiv.appendChild(input);
        } else if (pregunta.tipo === 'opciones') {
            const select = document.createElement('select');
            select.id = 'pregunta-' + pregunta.id;
            select.required = true;
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Selecciona una opción...';
            select.appendChild(defaultOption);

            pregunta.opciones.forEach(function(opcion) {
                const option = document.createElement('option');
                option.value = opcion.valor;
                option.textContent = opcion.texto;
                select.appendChild(option);
            });

            questionDiv.appendChild(select);
        }

        container.appendChild(questionDiv);
    });
}

async function handleVerifyIdentity(e) {
    e.preventDefault();
    
    const messageEl = document.getElementById('verify-message');
    const email = document.getElementById('recovery-email').value.trim();
    
    const respuestas = recoveryQuestions.map(function(pregunta) {
        const input = document.getElementById('pregunta-' + pregunta.id);
        return {
            id: pregunta.id,
            valor: input.value.trim()
        };
    });

    if (respuestas.some(function(r) { return !r.valor; })) {
        showMessage(messageEl, 'Por favor responde todas las preguntas', 'error');
        return;
    }

    try {
        showMessage(messageEl, 'Verificando identidad...', 'info');
        
        const response = await fetch('http://localhost:3000/api/recovery/verificar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                token: recoveryToken,
                respuestas: respuestas
            })
        });

        const data = await response.json();

        if (data.success) {
            showRecoverySuccess(data.info);
        } else {
            showMessage(messageEl, data.message || 'Error en la verificación', 'error');
        }

    } catch (error) {
        console.error('Error en verificación:', error);
        showMessage(messageEl, 'Error al procesar la verificación. Intenta nuevamente.', 'error');
    }
}

function showRecoverySuccess(info) {
    document.getElementById('verify-identity-form').style.display = 'none';
    document.getElementById('recovery-success').style.display = 'block';
    
    const accountInfoEl = document.getElementById('account-info');
    accountInfoEl.innerHTML = '<div style="background: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;"><h3 style="color: #1a365d; margin-top: 0;">Información de tu Cuenta:</h3><p><strong>Nombre:</strong> ' + info.nombre + '</p><p><strong>Email:</strong> ' + info.email + '</p><p><strong>Fecha de Registro:</strong> ' + new Date(info.fecha_registro).toLocaleDateString('es-VE') + '</p><p><strong>Actividad:</strong> ' + info.actividad + '</p></div>';
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = 'message ' + type;
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
