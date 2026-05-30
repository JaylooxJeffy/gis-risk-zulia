const pool = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD.replace(/\s/g, '')
    }
});

class RecoveryController {
    static async solicitarRecuperacion(req, res) {
        const { email } = req.body;

        try {
            const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

            if (userResult.rows.length === 0) {
                return res.json({
                    success: true,
                    message: 'Si existe una cuenta con este email, recibirás instrucciones de recuperación.'
                });
            }

            const usuario = userResult.rows[0];
            const passwordTemporal = crypto.randomBytes(4).toString('hex').toUpperCase();
            const hashedPassword = await bcrypt.hash(passwordTemporal, 10);

            await pool.query(
                'UPDATE usuarios SET password_hash = $1, password_temporal = TRUE WHERE id = $2',
                [hashedPassword, usuario.id]
            );

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Recuperación de Contraseña - GIS Risk Zulia',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1a365d;">Recuperación de Contraseña</h2>
                        <p>Hola <strong>${usuario.username}</strong>,</p>
                        <p>Has solicitado recuperar tu contraseña. Tu contraseña temporal es:</p>
                        <div style="background: #f0f4f8; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <h1 style="color: #2563eb; letter-spacing: 3px; font-family: monospace;">${passwordTemporal}</h1>
                        </div>
                        <p><strong>⚠️ Importante:</strong> Por seguridad, deberás cambiar esta contraseña al iniciar sesión.</p>
                        <p>Si no solicitaste esta recuperación, contacta con el administrador.</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        <p style="color: #64748b; font-size: 12px;">GIS Risk Zulia</p>
                    </div>
                `
            };

            console.log('📧 Enviando email a:', email);
            const info = await transporter.sendMail(mailOptions);
            console.log('✅ Email enviado:', info.messageId);

            res.json({
                success: true,
                message: 'Se ha enviado una contraseña temporal a tu email.'
            });

        } catch (error) {
            console.error('Error en recuperación:', error);
            res.status(500).json({
                success: false,
                error: 'Error al procesar la solicitud de recuperación'
            });
        }
    }

    static async cambiarPassword(req, res) {
        const { userId, newPassword } = req.body;

        try {
            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'La contraseña debe tener al menos 6 caracteres'
                });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            const result = await pool.query(
                'UPDATE usuarios SET password_hash = $1, password_temporal = FALSE WHERE id = $2 RETURNING id, username, email, rol',
                [hashedPassword, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            res.json({
                success: true,
                message: 'Contraseña actualizada correctamente',
                usuario: result.rows[0]
            });

        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            res.status(500).json({
                success: false,
                error: 'Error al cambiar la contraseña'
            });
        }
    }
}

module.exports = RecoveryController;
