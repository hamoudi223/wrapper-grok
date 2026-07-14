// api/toxic.js
import { STICKERS } from "./_stickers.js";

// 👑 METS TON NUMÉRO ICI
const MASTER_NUMBER = "22395064497";

// Modèles xAI à essayer dans l'ordre (fallback si surchargé/quota dépassé)
const MODEL_FALLBACKS = ["grok-4-fast", "grok-3-mini", "grok-2"];

const XAI_ENDPOINT = "https://api.x.ai/v1/chat/completions";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateWithFallback(apiKey, systemInstruction, text) {
  let lastError;

  for (const modelName of MODEL_FALLBACKS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(XAI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: text },
            ],
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          const err = new Error(`[${response.status}] ${errBody}`);
          err.status = response.status;
          throw err;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() ?? "";
      } catch (err) {
        lastError = err;
        const isOverloaded = err.status === 503 || err.status === 429;

        if (isOverloaded) {
          await sleep(600 * (attempt + 1));
          continue;
        }
        // erreur non transitoire (clé invalide, 400, modèle inconnu, etc.)
        break;
      }
    }
    // on passe au modèle suivant de la liste
  }

  throw lastError;
}

export default async function handler(req, res) {
  const { text, api, sender } = req.query || {};

  if (!text) {
    return res.status(400).json({
      status: false,
      error: "Tu veux quoi ? Envoie un vrai message au lieu de ping pour rien clown. 🤡",
    });
  }

  const apiKey = api || process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ status: false, error: "Clé API xAI absente." });
  }

  try {
    const isMaster = sender && sender.includes(MASTER_NUMBER);

    let systemInstruction = "";
    if (isMaster) {
      systemInstruction =
        "Tu es d'habitude un utilisateur Discord ultra-toxique et aigri, MAIS là, tu parles à ton MAÎTRE absolu (Mohamed). Pour lui et uniquement pour lui, tu es d'une soumission totale, extrêmement respectueux, d'accord avec tout ce qu'il dit. Tu l'appelles obligatoirement 'Maître Mohamed', 'Mon Seigneur' ou 'Boss', tout en gardant un vocabulaire légèrement gamer/Discord pour rester dans le ton. S'il te donne l'ordre de clasher ou de ratio quelqu'un, tu t'exécutes avec une joie immense.";
    } else {
      systemInstruction =
        "Tu es un utilisateur Discord ultra-toxique, aigri, arrogant, blasé et condescendant. Tu parles comme un gamer frustré sur un serveur communautaire. Utilise le jargon : 'wsh', 'ratio', 'masterclass', 'askip', 'flemme', 't'es qui ?', 'chiale', 'clochard', 'le flop'. Écris un maximum en minuscules, fais des phrases courtes, sèches et piquantes. Ne sois JAMAIS poli ou amical. Ajoute parfois des émojis condescendants comme 💀, 🤡, 🤫, 😮‍💨.";
    }

    const aiResponse = await generateWithFallback(apiKey, systemInstruction, text);
    const randomSticker = STICKERS[Math.floor(Math.random() * STICKERS.length)];

    return res.status(200).json({
      status: true,
      content: {
        message: aiResponse,
        sticker: randomSticker,
      },
    });
  } catch (error) {
    console.error("Erreur :", error.message);
    return res.status(500).json({
      status: false,
      error: "Une erreur est survenue lors de l'appel à l'IA.",
      details: error.message,
    });
  }
}
