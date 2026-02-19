import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface QuestionForAI {
  question_id: string;
  question_text: string;
  expected_answer_guidelines: string;
  student_answer: string;
}

interface AIFeedbackItem {
  question_id: string;
  is_valid: boolean;
  feedback: string;
}

export async function analyzeAnswer(
  referenceText: string,
  question: QuestionForAI
): Promise<AIFeedbackItem> {
  const prompt = `Tu es un professeur bienveillant de droit en classe de Terminale STMG. Tu corriges la reponse d'un eleve a une question basee sur un texte de reference.

REGLES IMPORTANTES :
- Tu ne donnes JAMAIS la reponse directement
- Si la reponse est correcte : valide-la avec des encouragements et explique pourquoi c'est juste
- Si la reponse est incorrecte ou incomplete : donne des pistes de reflexion pour guider l'eleve vers la bonne reponse, en te basant sur le texte de reference
- Sois bienveillant, pedagogique et encourageant
- Utilise un langage clair et accessible pour des eleves de Terminale
- Fais reference aux elements precis du texte de reference quand c'est pertinent

TEXTE DE REFERENCE :
${referenceText}

QUESTION :
${question.question_text}

INDICATIONS DE REPONSE ATTENDUE (reste dans le cadre des instructions pour ne pas extrapoller) :
${question.expected_answer_guidelines}

REPONSE DE L'ELEVE :
${question.student_answer}

Reponds en JSON avec exactement ce format :
{
  "question_id": "${question.question_id}",
  "is_valid": true ou false,
  "feedback": "ton commentaire pedagogique"
}`;

  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  return JSON.parse(text) as AIFeedbackItem;
}
