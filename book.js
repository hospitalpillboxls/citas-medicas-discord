const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL;


const SCHEDULE = {

  0: [],

  1: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  2: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  3: [
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30"
  ],

  4: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  5: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  6: []

};


function json(statusCode, data) {

  return {

    statusCode,

    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },

    body: JSON.stringify(data)

  };

}


function limpiar(valor, maximo) {

  return String(valor || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maximo);

}


exports.handler = async function(event) {

  try {

    if (event.httpMethod !== "POST") {

      return json(405, {
        ok: false,
        error: "Método no permitido."
      });

    }


    if (!SUPABASE_URL) {

      return json(500, {
        ok: false,
        error: "Falta SUPABASE_URL en Netlify."
      });

    }


    if (!SUPABASE_SERVICE_ROLE_KEY) {

      return json(500, {
        ok: false,
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en Netlify."
      });

    }


    let data;

    try {

      data = JSON.parse(event.body || "{}");

    } catch {

      return json(400, {
        ok: false,
        error: "Los datos enviados no son válidos."
      });

    }


    const date = limpiar(data.date, 10);
    const time = limpiar(data.time, 5);
    const name = limpiar(data.name, 100);
    const email = limpiar(data.email, 150);
    const phone = limpiar(data.phone, 30);


    if (!date || !time || !name || !email || !phone) {

      return json(400, {
        ok: false,
        error: "Todos los campos son obligatorios."
      });

    }


    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {

      return json(400, {
        ok: false,
        error: "Fecha incorrecta."
      });

    }


    if (!/^\d{2}:\d{2}$/.test(time)) {

      return json(400, {
        ok: false,
        error: "Hora incorrecta."
      });

    }


    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

      return json(400, {
        ok: false,
        error: "Correo electrónico incorrecto."
      });

    }


    const fecha = new Date(`${date}T12:00:00`);

    if (Number.isNaN(fecha.getTime())) {

      return json(400, {
        ok: false,
        error: "Fecha inválida."
      });

    }


    const diaSemana = fecha.getDay();

    const horarios = SCHEDULE[diaSemana] || [];


    if (!horarios.includes(time)) {

      return json(400, {
        ok: false,
        error: "Ese horario no está disponible."
      });

    }


    /*
      Comprobamos que la cita no esté ocupada.
    */

    const consultaUrl =
      `${SUPABASE_URL}/rest/v1/appointments` +
      `?date=eq.${encodeURIComponent(date)}` +
      `&time=eq.${encodeURIComponent(time)}` +
      `&select=id`;


    const consulta = await fetch(consultaUrl, {

      method: "GET",

      headers: {

        "apikey": SUPABASE_SERVICE_ROLE_KEY,

        "Authorization":
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`

      }

    });


    if (!consulta.ok) {

      const errorText = await consulta.text();

      console.error(
        "Error consultando Supabase:",
        errorText
      );

      return json(500, {
        ok: false,
        error: "No se pudo comprobar la disponibilidad."
      });

    }


    const existentes = await consulta.json();


    if (existentes.length > 0) {

      return json(409, {

        ok: false,

        error:
          "Esa hora acaba de ser reservada por otra persona."

      });

    }


    /*
      Creamos la cita.
    */

    const insertUrl =
      `${SUPABASE_URL}/rest/v1/appointments`;


    const insert = await fetch(insertUrl, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        "apikey": SUPABASE_SERVICE_ROLE_KEY,

        "Authorization":
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

        "Prefer": "return=representation"

      },

      body: JSON.stringify({

        date,

        time,

        name,

        email,

        phone,

        status: "reserved"

      })

    });


    const insertText = await insert.text();


    if (!insert.ok) {

      console.error(
        "Error insertando en Supabase:",
        insertText
      );


      /*
        23505 = unique_violation.
        Esto protege también contra dos personas
        reservando exactamente la misma hora.
      */

      if (
        insertText.includes("23505") ||
        insertText.toLowerCase().includes("duplicate")
      ) {

        return json(409, {

          ok: false,

          error:
            "Esa hora acaba de ser reservada por otra persona."

        });

      }


      return json(500, {

        ok: false,

        error:
          "No se pudo guardar la cita en Supabase."

      });

    }


    /*
      Aviso opcional a Discord.
      Si DISCORD_WEBHOOK_URL no está configurado,
      simplemente no se envía.
    */

    if (DISCORD_WEBHOOK_URL) {

      try {

        const payload = {

          username: "Sistema de Citas",

          embeds: [

            {

              title: "📅 NUEVA SOLICITUD DE CITA",

              color: 5639939,

              fields: [

                {
                  name: "👤 Nombre",
                  value: name,
                  inline: true
                },

                {
                  name: "📞 Teléfono",
                  value: phone,
                  inline: true
                },

                {
                  name: "📧 Correo",
                  value: email,
                  inline: false
                },

                {
                  name: "📅 Día",
                  value: date,
                  inline: true
                },

                {
                  name: "🕐 Hora",
                  value: time,
                  inline: true
                }

              ]

            }

          ]

        };


        await fetch(DISCORD_WEBHOOK_URL, {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)

        });

      } catch (discordError) {

        /*
          Si Discord falla, NO anulamos la reserva.
        */

        console.error(
          "Discord:",
          discordError
        );

      }

    }


    return json(200, {

      ok: true,

      message: "Cita reservada correctamente.",

      appointment: {

        date,

        time,

        name,

        email,

        phone

      }

    });


  } catch (error) {

    console.error(error);

    return json(500, {

      ok: false,

      error:
        error.message || "Error interno del servidor."

    });

  }

};
