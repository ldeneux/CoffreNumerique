// Fonction Supabase Edge : reçoit un scan (image ou PDF) de carnet de santé
// en base64, l'envoie à l'API Gemini pour en extraire les vaccinations, et
// renvoie une liste structurée { vaccineName, dateAdministered, lotNumber,
// doseLabel } par entrée détectée.
//
// Cette fonction ne modifie JAMAIS la base de données elle-même : elle se
// contente de lire le document et de répondre. L'enregistrement effectif des
// vaccinations se fait côté client, uniquement après relecture manuelle par
// l'utilisateur (voir HealthImportPanel dans components/CoffreApp.jsx).
//
// Déploiement : voir le README, section "Carnet de santé (extraction par IA)".
// Nécessite un secret GEMINI_API_KEY (clé obtenue sur https://aistudio.google.com/apikey).

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Modèle utilisé via l'API classique generateContent. gemini-2.5-flash n'est
// plus proposé aux nouvelles clés API (Google pousse vers gemini-3.8-flash,
// mais uniquement via sa nouvelle "Interactions API", différente de celle-ci) ;
// gemini-2.5-flash-lite reste disponible sur generateContent.
const GEMINI_MODEL = "gemini-2.5-flash-lite";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    entries: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          vaccineName: { type: "STRING", description: "Nom du vaccin tel qu'écrit sur le carnet (ex: DTPolio, ROR, Prevenar13...)" },
          dateAdministered: { type: "STRING", description: "Date d'administration au format AAAA-MM-JJ. Chaîne vide si illisible ou absente." },
          lotNumber: { type: "STRING", description: "Numéro de lot du vaccin. Chaîne vide si illisible ou absent." },
          doseLabel: { type: "STRING", description: "Numéro de dose ou type de rappel (ex: '1ère dose', 'rappel'). Chaîne vide si non précisé." },
        },
        required: ["vaccineName", "dateAdministered", "lotNumber", "doseLabel"],
      },
    },
  },
  required: ["entries"],
};

const PROMPT = `Tu lis un scan ou une photo d'une page de carnet de santé français (souvent remplie à la main par un médecin).
Extrais UNIQUEMENT les lignes de vaccination que tu peux lire avec une confiance raisonnable : nom du vaccin, date, numéro de lot, numéro de dose/rappel.
Règles :
- Une entrée par injection (un carnet mentionne souvent plusieurs vaccins combinés à la même date : dans ce cas, une entrée par vaccin nommé).
- Si un champ est illisible, incertain, ou absent, renvoie une chaîne vide pour ce champ plutôt que d'inventer une valeur.
- N'extrais aucune autre information (poids, taille, courbes de croissance, consultations...) : uniquement les vaccinations.
- Réponds strictement selon le schéma JSON demandé, sans texte autour.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  console.log(`[extract-health-record] requête reçue : ${req.method}`);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  console.log(`[extract-health-record] GEMINI_API_KEY ${apiKey ? "présente" : "ABSENTE"}`);
  if (!apiKey) {
    return jsonResponse(
      { error: "GEMINI_API_KEY n'est pas configurée côté Supabase (Project Settings > Edge Functions > Secrets). Voir le README." },
      500
    );
  }

  let base64: string | undefined;
  let mimeType: string | undefined;
  try {
    const body = await req.json();
    base64 = body?.base64;
    mimeType = body?.mimeType;
  } catch {
    return jsonResponse({ error: "Corps de requête invalide : attendu { base64, mimeType }." }, 400);
  }
  if (!base64 || typeof base64 !== "string") {
    return jsonResponse({ error: "Fichier manquant (champ base64 vide)." }, 400);
  }
  console.log(`[extract-health-record] fichier reçu : ${mimeType}, ${Math.round((base64.length * 3) / 4 / 1024)} Ko environ`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType: mimeType || "application/octet-stream", data: base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  };

  // Garde-fou : la limite de temps d'inactivité des Edge Functions Supabase
  // est de 150s (au-delà, la plateforme coupe la connexion sans réponse
  // propre, ce que le navigateur voit comme "Failed to send a request").
  // On abandonne l'appel à Gemini avant cette limite pour renvoyer un
  // message clair plutôt que de laisser la plateforme couper sans explication.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  console.log("[extract-health-record] appel à Gemini...");
  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      return jsonResponse(
        { error: "L'analyse a pris trop de temps (plus de 2 minutes). Essayez avec moins de pages à la fois, ou une photo plutôt qu'un PDF complet." },
        504
      );
    }
    return jsonResponse({ error: "Impossible de contacter l'API Gemini." }, 502);
  } finally {
    clearTimeout(timeout);
  }
  console.log(`[extract-health-record] Gemini a répondu : ${geminiRes.status}`);

  if (!geminiRes.ok) {
    const detail = await geminiRes.text().catch(() => "");
    return jsonResponse({ error: `Erreur Gemini (${geminiRes.status}). ${detail.slice(0, 300)}` }, 502);
  }

  const data = await geminiRes.json().catch(() => null);
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return jsonResponse({ error: "Réponse Gemini vide ou inattendue." }, 502);
  }

  let parsed: { entries?: unknown[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "La réponse de Gemini n'était pas un JSON valide." }, 502);
  }

  console.log(`[extract-health-record] ${Array.isArray(parsed.entries) ? parsed.entries.length : 0} entrée(s) extraite(s)`);
  return jsonResponse({ entries: Array.isArray(parsed.entries) ? parsed.entries : [] });
});
