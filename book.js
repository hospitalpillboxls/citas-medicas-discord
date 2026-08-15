const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function validTime(time) {
  return /^\d{2}:\d{2}$/.test(time);
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return response(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      return response(405, {
        ok: false,
        error: "Método no permitido"
      });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return response(500, {
        ok: false,
        error: "Faltan las variables de Supabase en Netlify"
      });
    }

    let data;

    try {
      data = JSON.parse(event.body || "{}");
    } catch {
      return response(400, {
        ok: false,
        error: "Datos JSON inválidos"
      });
    }

    const date = clean(data.date, 10);
    const time = clean(data.time, 5);
    const name = clean(data.name, 100);
    const email = clean(data.email, 150);
    const phone = clean(data.phone, 30);

    if (!date || !time || !name || !email || !phone) {
      return response(400, {
        ok: false,
        error: "Todos los campos son obligatorios"
      });
    }

    if (!validDate(date)) {
      return response(400, {
        ok: false,
        error: "Fecha inválida"
      });
    }

    if (!validTime(time)) {
      return response(400, {
        ok: false,
        error: "Hora inválida"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response(400, {
        ok: false,
        error: "Correo electrónico inválido"
      });
    }

    const dateObject = new Date(`${date}T12:00:00`);

    if (
      Number.isNaN(dateObject.getTime()) ||
      dateObject.toISOString().slice(0, 10) !== date
    ) {
      return response(400, {
        ok: false,
        error: "Fecha inválida"
      });
    }

    const day = dateObject.getDay();

    const slots = SCHEDULE[day] || [];

    if (!slots.includes(time)) {
      return response(400, {
        ok: false,
        error: "Ese horario no está disponible"
      });
    }

    /*
     * Comprobamos primero si ya existe.
     */

    const checkUrl =
      `${SUPABASE_URL}/rest/v1/appointments` +
      `?select=id` +
      `&date=eq.${encodeURIComponent(date)}` +
      `&time=eq.${encodeURIComponent(time)}` +
      `&status=eq.reservado` +
      `&limit=1`;

    const check = await fetch(checkUrl, {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!check.ok) {
      const text = await check.text();

      console.error("Error consultando Supabase:", text);

      return response(500, {
        ok: false,
        error: "No se pudo comprobar la disponibilidad"
      });
    }

    const existing = await check.json();

    if (existing.length > 0) {
      return response(409, {
        ok: false,
        error: "Esa hora acaba de ser reservada. Elige otra."
      });
    }

    /*
     * Creamos la reserva.
     *
     * El índice UNIQUE de Supabase protege también
     * contra dos personas reservando exactamente
     * el mismo horario al mismo tiempo.
     */

    const insertUrl = `${SUPABASE_URL}/rest/v1/appointments`;

    const insert = await fetch(insertUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        date,
        time,
        name,
        email,
        phone,
        status: "reservado"
      })
    });

    if (!insert.ok) {
      const errorText = await insert.text();

      console.error("Error insertando reserva:", errorText);

      /*
       * 23505 = unique_violation de PostgreSQL.
       */
      if (errorText.includes("23505")) {
        return response(409, {
          ok: false,
          error: "Esa hora acaba de ser reservada. Elige otra."
        });
      }

      return response(500, {
        ok: false,
        error: "No se pudo guardar la reserva"
      });
    }

    const reservation = await insert.json();

    return response(200, {
      ok: true,
      message: "Reserva realizada correctamente",
      reservation: reservation[0] || null
    });

  } catch (error) {
    console.error(error);

    return response(500, {
      ok: false,
      error: "Error interno del servidor"
    });
  }
};
