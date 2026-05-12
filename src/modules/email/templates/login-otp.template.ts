interface LoginOtpTemplateParams {
  username: string;
  code: string;
  expiresInMinutes: number;
}

export function buildLoginOtpTemplate(p: LoginOtpTemplateParams): {
  html: string;
  text: string;
} {
  const formatted = `${p.code.slice(0, 3)} ${p.code.slice(3)}`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#faf8f5;font-family:Georgia,serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border:1px solid #e8e0d0;border-radius:8px;padding:40px;">
        <h1 style="color:#2c1810;font-size:22px;margin:0 0 24px;">PlotCraft</h1>
        <p style="color:#5c4a3a;margin:0 0 8px;">Hola, <strong>${p.username}</strong>.</p>
        <p style="color:#5c4a3a;margin:0 0 32px;">Usa el siguiente codigo para iniciar sesion en el panel de administracion:</p>
        <div style="text-align:center;margin:0 0 32px;">
          <span style="display:inline-block;font-size:44px;font-weight:bold;letter-spacing:12px;color:#2c1810;background:#faf8f5;padding:16px 24px;border-radius:6px;border:1px solid #e8e0d0;">
            ${formatted}
          </span>
        </div>
        <p style="color:#8c7a6a;font-size:13px;line-height:1.5;margin:0;">
          Este codigo expira en <strong>${p.expiresInMinutes} minutos</strong>.<br/>
          Si no solicitaste este codigo, puedes ignorar este correo.
        </p>
      </div>
    </body>
    </html>
  `.trim();

  const text = [
    'PlotCraft — Codigo de inicio de sesion',
    '',
    `Hola, ${p.username}.`,
    `Tu codigo para iniciar sesion es: ${formatted}`,
    `Expira en ${p.expiresInMinutes} minutos.`,
    '',
    'Si no solicitaste este codigo, ignora este mensaje.',
  ].join('\n');

  return { html, text };
}
