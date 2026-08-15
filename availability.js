const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEDULE = {
  0: [], // Domingo cerrado

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

  6: [] // Sábado cerrado
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return response(200, { ok: true });
    }

    if (event.httpMethod !== "GET") {
      return response(405, {
        ok: false,
        error: "Método no permitido"
      });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return response(500, {
        ok: false,
        error: "Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    const date = event.queryStringParameters?.date;

    if (!date || !validDate(date)) {
      return response(400, {
        ok: false,
        error: "Debes indicar una fecha válida: YYYY-MM-DD"
      });
    }

    // Evita fechas inexistentes como 2026-02-31
    const testDate = new Date(`${date}T12:00:00`);

    if (
      Number.isNaN(testDate.getTime()) ||
      testDate.toISOString().slice(0, 10) !== date
    ) {
      return response(400, {
        ok: false,
        error: "Fecha inválida"
      });
    }

    const day = testDate.getDay();

    const availableSlots = SCHEDULE[day] || [];

    // Consultamos las reservas existentes de ese día.
    const url =
      `${SUPABASE_URL}/rest/v1/appointments` +
      `?select=time` +
      `&date=eq.${encodeURIComponent(date)}` +
      `&status=eq.reservado`;

    const result = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!result.ok) {
      const errorText = await result.text();

      console.error("Supabase:", errorText);

      return response(500, {
        ok: false,
        error: "No se pudieron consultar las reservas"
      });
    }

    const appointments = await result.json();

    const booked = appointments.map((item) => {
      return String(item.time).slice(0, 5);
    });

    const slots = availableSlots.map((time) => ({
      time,
      available: !booked.includes(time)
    }));

    return response(200, {
      ok: true,
      date,
      day,
      slots
    });

  } catch (error) {
    console.error(error);

    return response(500, {
      ok: false,
      error: "Error interno del servidor"
    });
  }
};
