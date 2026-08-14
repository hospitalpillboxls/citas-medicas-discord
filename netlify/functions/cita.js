exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== "POST") {
    return json(405, {
      ok: false,
      error: "Método no permitido"
    });
  }

  const webhook = process.env.DISCORD_WEBHOOK_URL;

  if (!webhook) {
    return json(500, {
      ok: false,
      error: "No está configurado el webhook de Discord en Netlify"
    });
  }

  let data;

  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, {
      ok: false,
      error: "Los datos enviados no son válidos"
    });
  }

  const campos = [
    "nombre",
    "telefono",
    "especialidad",
    "fecha",
    "hora",
    "motivo"
  ];

  for (const campo of campos) {
    if (!data[campo] || String(data[campo]).trim() === "") {
      return json(400, {
        ok: false,
        error: "Falta el campo: " + campo
      });
    }
  }

  const limpiar = (valor, maximo = 1000) => {
    return String(valor)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .trim()
      .slice(0, maximo);
  };

  const mensaje = {
    username: "Sistema de Citas",

    allowed_mentions: {
      parse: []
    },

    embeds: [
      {
        title: "📅 NUEVA SOLICITUD DE CITA",

        description:
          "Se ha recibido una nueva solicitud desde la página web.",

        color: 563399,

        fields: [
          {
            name: "👤 Nombre completo",
            value: limpiar(data.nombre, 100),
            inline: true
          },

          {
            name: "📞 Teléfono",
            value: limpiar(data.telefono, 30),
            inline: true
          },

          {
            name: "🩺 Especialidad",
            value: limpiar(data.especialidad, 100),
            inline: false
          },

          {
            name: "📅 Fecha preferente",
            value: limpiar(data.fecha, 30),
            inline: true
          },

          {
            name: "🕐 Hora preferente",
            value: limpiar(data.hora, 30),
            inline: true
          },

          {
            name: "📝 Motivo de la consulta",
            value: limpiar(data.motivo, 1500),
            inline: false
          }
        ],

        footer: {
          text: "Formulario de citas • Discord"
        }
      }
    ]
  };

  try {
    const respuesta = await fetch(webhook, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(mensaje)
    });

    if (!respuesta.ok) {
      return json(502, {
        ok: false,
        error: "Discord rechazó la solicitud. Código: " +
          respuesta.status
      });
    }

    return json(200, {
      ok: true
    });

  } catch (error) {

    return json(502, {
      ok: false,
      error: "No se pudo conectar con Discord"
    });
  }
};
