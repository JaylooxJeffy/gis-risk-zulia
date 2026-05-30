const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD.replace(/\s/g, ''),
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en email:', error);
  } else {
    console.log('✅ Servidor de email listo');
  }
});

const sendNewRequestNotification = async (solicitud) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: `🔔 Nueva Solicitud - ${solicitud.rol_solicitado}`,
    html: `<h2>Nueva Solicitud de Registro</h2>
           <p><strong>Usuario:</strong> ${solicitud.nombre_usuario}</p>
           <p><strong>Email:</strong> ${solicitud.email}</p>
           <p><strong>Rol:</strong> ${solicitud.rol_solicitado}</p>`
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
};

const sendAccessCode = async (email, codigo, rol) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '✅ Código de Acceso',
    html: `<h2>Solicitud Aprobada</h2><p>Tu código: <strong>${codigo}</strong></p>`
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    return false;
  }
};

const sendRejectionEmail = async (email, nombreUsuario) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '❌ Solicitud No Aprobada',
    html: `<h2>Solicitud Rechazada</h2><p>Tu solicitud no fue aprobada.</p>`
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    return false;
  }
};

// Función para enviar credenciales recuperadas
const sendRecoveryEmail = async (email, nombreCompleto, nuevaPassword, totalReportes, fechaRegistro) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔐 Recuperación de Credenciales - GIS Risk Zulia',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #1a5f3f; border-bottom: 3px solid #2d8659; padding-bottom: 10px;">
          🔐 Recuperación de Credenciales
        </h2>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hola <strong>${nombreCompleto}</strong>,
        </p>
        
        <div style="background: #e0f2f1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00897b;">
          <p style="margin: 0 0 15px; color: #004d40;">
            Has solicitado recuperar tus credenciales. A continuación encontrarás tu información de acceso:
          </p>
        </div>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1a365d; margin-top: 0;">📧 Correo Electrónico:</h3>
          <p style="font-family: 'Courier New', monospace; font-size: 16px; color: #2d8659; margin: 0;">
            ${email}
          </p>
        </div>
        
        <div style="background: #1a365d; color: white; padding: 25px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px; font-size: 14px; opacity: 0.9;">Tu Nueva Contraseña Temporal:</p>
          <h1 style="margin: 0; font-size: 28px; letter-spacing: 3px; font-family: 'Courier New', monospace;">
            ${nuevaPassword}
          </h1>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0 0 10px; color: #856404;">
            ⚠️ <strong>Importante:</strong>
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #856404;">
            <li>Esta es una contraseña temporal</li>
            <li>Cámbiala después de iniciar sesión</li>
          </ul>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          Sistema GIS Risk Zulia
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email de recuperacion enviado a' + email);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de recuperación:', error);
    return false;
  }
};


module.exports = {
  transporter,
  sendNewRequestNotification,
  sendAccessCode,
  sendRejectionEmail,
  sendRecoveryEmail,
};;


