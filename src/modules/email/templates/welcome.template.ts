interface WelcomeTemplateParams {
  username: string;
  nickname: string;
}

export function buildWelcomeTemplate(p: WelcomeTemplateParams): { html: string; text: string } {
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
        <p style="color:#5c4a3a;margin:0 0 8px;">Bienvenido, <strong>${p.nickname}</strong>.</p>
        <p style="color:#5c4a3a;margin:0 0 24px;">Tu cuenta ha sido verificada exitosamente. Ya puedes empezar a escribir, compartir y descubrir historias en PlotCraft.</p>
        <p style="color:#8c7a6a;font-size:13px;margin:0;">
          Tu nombre de usuario es <strong>@${p.username}</strong>.
        </p>
      </div>
    </body>
    </html>
  `.trim();

  const text = [
    'PlotCraft — Bienvenido',
    '',
    `Hola, ${p.nickname}.`,
    'Tu cuenta ha sido verificada exitosamente.',
    `Tu nombre de usuario es @${p.username}.`,
  ].join('\n');

  return { html, text };
}
