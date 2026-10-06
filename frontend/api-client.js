const API_URL = 'http://localhost:3000/api';

class ApiClient {
    static getToken() {
        if (localStorage.getItem('gis_token')) {
            localStorage.removeItem('gis_token');
            localStorage.removeItem('gis_user');
        }
        return sessionStorage.getItem('gis_token');
    }

    static saveToken(token) {
        sessionStorage.setItem('gis_token', token);
    }

    static removeToken() {
        sessionStorage.removeItem('gis_token');
    }

    static saveUser(user) {
        sessionStorage.setItem('gis_user', JSON.stringify(user));
    }

    static getUser() {
        const user = sessionStorage.getItem('gis_user');
        return user ? JSON.parse(user) : null;
    }

    static removeUser() {
        sessionStorage.removeItem('gis_user');
    }

    static isAuthenticated() {
        return !!this.getToken();
    }

    static async validateSession() {
        if (!this.getToken()) return false;
        try {
            const response = await this.fetch('/auth/perfil');
            if (!response.success) {
                this.removeToken();
                this.removeUser();
                return false;
            }
            if (response.usuario) {
                const currentUser = this.getUser();
                this.saveUser({ ...currentUser, ...response.usuario });
            }
            return true;
        } catch (error) {
            this.removeToken();
            this.removeUser();
            return false;
        }
    }

    static async fetch(endpoint, options = {}) {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
            const data = await response.json();
            if (response.ok) return { success: true, ...data };
            return { success: false, message: data.error || data.mensaje || 'Error en la petición', statusCode: response.status, error: data.error };
        } catch (error) {
            console.error('Error de conexión:', error);
            return { success: false, message: 'Error de conexión con el servidor.', error: error.message };
        }
    }

    // ========== AUTH ==========
    static async registroConsultor(username, email, password) {
        return await this.fetch('/auth/registro/consultor', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    }

    static async solicitarRegistro(username, email, rol) {
        return await this.fetch('/auth/solicitud', { method: 'POST', body: JSON.stringify({ username, email, rol }) });
    }

    static async completarRegistro(email, codigo, password) {
        return await this.fetch('/auth/completar-registro', { method: 'POST', body: JSON.stringify({ email, codigo, password }) });
    }

    static async login(email, password) {
        return await this.fetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    }

    static async loginConCuenta(email, password, userId) {
        return await this.fetch('/auth/login-cuenta', { method: 'POST', body: JSON.stringify({ email, password, userId }) });
    }

    static async verificarSolicitud(email) {
        return await this.fetch(`/auth/solicitud/${email}`);
    }

    static async obtenerPerfil() {
        return await this.fetch('/auth/perfil');
    }

    // ========== ADMIN ==========
    static async listarSolicitudesPendientes() {
        return await this.fetch('/admin/solicitudes/pendientes');
    }

    static async listarTodasSolicitudes() {
        return await this.fetch('/admin/solicitudes');
    }

    static async aprobarSolicitud(id) {
        return await this.fetch(`/admin/solicitudes/${id}/aprobar`, { method: 'POST' });
    }

    static async rechazarSolicitud(id) {
        return await this.fetch(`/admin/solicitudes/${id}/rechazar`, { method: 'POST' });
    }

    static async regenerarCodigo(id) {
        return await this.fetch(`/admin/solicitudes/${id}/regenerar-codigo`, { method: 'POST' });
    }

    static async contarSolicitudesPendientes() {
        return await this.fetch('/admin/solicitudes/contar');
    }

    static async listarUsuarios() {
        return await this.fetch('/admin/usuarios');
    }

    static async desactivarUsuario(id) {
        return await this.fetch(`/admin/usuarios/${id}/desactivar`, { method: 'PATCH' });
    }

    static async activarUsuario(id) {
        return await this.fetch(`/admin/usuarios/${id}/activar`, { method: 'PATCH' });
    }

    static async delegarAdmin(id) {
        return await this.fetch(`/admin/usuarios/${id}/delegar`, { method: 'PATCH' });
    }

    static async quitarDelegacionAdmin(id) {
        return await this.fetch(`/admin/usuarios/${id}/quitar-delegacion`, { method: 'PATCH' });
    }

    static async obtenerMisPermisos() {
        return await this.fetch('/admin/mis-permisos');
    }

    // ========== FACTORES DE RIESGO ==========
    static async listarFactores() {
        return await this.fetch('/factores');
    }

    static async listarFactoresAdmin() {
        return await this.fetch('/admin/factores');
    }

    static async verificarSimilitudFactor(nombre) {
        return await this.fetch('/admin/factores/verificar-similitud', { method: 'POST', body: JSON.stringify({ nombre }) });
    }

    static async crearFactor(factor) {
        return await this.fetch('/admin/factores', { method: 'POST', body: JSON.stringify(factor) });
    }

    static async editarFactor(id, factor) {
        return await this.fetch(`/admin/factores/${id}`, { method: 'PUT', body: JSON.stringify(factor) });
    }

    static async desactivarFactor(id) {
        return await this.fetch(`/admin/factores/${id}/desactivar`, { method: 'PATCH' });
    }

    static async activarFactor(id) {
        return await this.fetch(`/admin/factores/${id}/activar`, { method: 'PATCH' });
    }

    // ========== ANALISTA ==========
    static async guardarUbicacion(datos) {
        return await this.fetch('/analista/ubicaciones', { method: 'POST', body: JSON.stringify(datos) });
    }

    static async listarUbicaciones() {
        return await this.fetch('/analista/ubicaciones');
    }

    static async actualizarNotas(id, notas) {
        return await this.fetch(`/analista/ubicaciones/${id}/notas`, { method: 'PATCH', body: JSON.stringify({ notas }) });
    }

    static async eliminarUbicacion(id) {
        return await this.fetch(`/analista/ubicaciones/${id}`, { method: 'DELETE' });
    }

    // ========== FIRMS (NASA) ==========
    static async consultarIncendios(lat, lng) {
        return await this.fetch(`/firms/incendios?lat=${lat}&lng=${lng}`);
    }

    static logout() {
        this.removeToken();
        this.removeUser();
        window.location.href = '/';
    }
}

window.ApiClient = ApiClient;
