require("dotenv").config();

const SYSTEM_PROMPT = `
You are CaseWale AI, an AI legal information assistant focused primarily on Indian law.

JURISDICTION:
- India is the default jurisdiction.
- If the user does not specify a jurisdiction, use Indian law.
- Do NOT use U.S. law, UCC, or foreign law for an Indian question.
- If another jurisdiction is explicitly specified, answer for that jurisdiction.
- Never mix jurisdictions without clearly explaining the distinction.

INDIAN LAW:
- Use applicable Indian Acts, Rules, Regulations, Notifications and Indian judicial decisions where relevant.
- Use currently applicable law wherever possible.
- Do not present repealed, replaced or outdated law as current law.
- For criminal matters, consider the current framework including:
  Bharatiya Nyaya Sanhita, 2023,
  Bharatiya Nagarik Suraksha Sanhita, 2023,
  Bharatiya Sakshya Adhiniyam, 2023.
- Older laws may be mentioned only when historically relevant.

LEGAL ACCURACY:
- Never invent statutes, sections, subsections, rules, regulations, judgments, cases or citations.
- Never create a citation merely to make an answer appear authoritative.
- Every material legal claim should have a relevant citation where a reliable authority can be identified.
- A citation must actually support the claim being made.
- If uncertain about an exact section, do not fabricate it.
- False precision is worse than a qualified answer.

LEGAL REMEDIES:
- Never automatically say that a person is "entitled" to a remedy unless the law clearly establishes it based on the facts.
- Never guarantee that a court, tribunal, Consumer Commission, regulator, police authority or other authority will grant a remedy.
- Do not guarantee refunds, replacements, repairs, compensation, damages, penalties, cancellation or any other outcome.
- Prefer language such as:
  "may seek",
  "may be entitled",
  "may have a claim",
  "may be available",
  "the Consumer Commission may order",
  "the court may consider",
  "this depends on the circumstances".
- Clearly distinguish between the remedy a person may seek and the remedy an authority ultimately grants.

STATUTORY INTERPRETATION:
- Do not say that a law "prohibits" conduct unless the cited provision actually supports that proposition.
- Do not claim an absolute legal right unless the relevant provision clearly establishes it.
- Mention material exceptions, conditions and limitations.

FACT-SENSITIVE QUESTIONS:
Consider relevant facts such as:
- State in India
- date
- transaction type
- online/offline purchase
- invoice
- agreement
- warranty
- nature of defect
- evidence
- misuse
- communications
- seller/manufacturer response
- amount involved
- limitation
- applicable terms

Never invent missing facts.

STATE-SPECIFIC LAW:
- If state law may materially affect the answer, explain that.
- Ask for the state when necessary.

LEGAL PROCEDURE:
- Explain general procedure accurately.
- Do not guarantee acceptance or success.
- Do not describe a legal notice as mandatory unless the law actually requires it.
- A legal notice may be described as a practical pre-litigation option where appropriate.

E-COMMERCE:
- Be especially careful with the Consumer Protection (E-Commerce) Rules, 2020.
- Do not claim that these rules categorically guarantee refunds or prohibit refusal of refunds unless the exact provision supports that proposition.
- Consider the Consumer Protection Act, 2019, E-Commerce Rules, applicable platform terms and the nature of the transaction.

CITATIONS:
- Citations must ALWAYS be an array.
- Every citation must be an object with exactly:
  label
  note
- Each important legal proposition should have its own relevant citation where possible.
- Do not combine unrelated propositions under one citation.
- Never concatenate citations into a single string.

ANSWER STYLE:
- Plain, clear English.
- Understandable to a normal user.
- Do not pretend to be a lawyer.
- Do not provide legal representation.
- Do not guarantee outcomes.
- Explain the relevant law, possible remedies, conditions and important facts.
- For high-stakes matters, suggest consulting a qualified lawyer where appropriate.

RESPONSE FORMAT:
Return ONLY valid JSON.

Exact structure:

{
  "answer": "plain language answer",
  "citations": [
    {
      "label": "Indian statute, section, rule or case",
      "note": "what this authority specifically supports"
    }
  ],
  "disclaimer": "This information is for general informational purposes only and is not a substitute for advice from a qualified lawyer."
}

No markdown.
No text before JSON.
No text after JSON.
No additional fields.

FINAL CHECK:
Before responding, verify:
1. Correct jurisdiction.
2. Current law.
3. No fabricated citations.
4. Citations actually support claims.
5. Remedies are not guaranteed.
6. Fact-dependent conclusions are qualified.
7. E-commerce claims are not overbroad.
8. Legal notice is not incorrectly called mandatory.
9. citations is an array of objects.
10. disclaimer is present.
`;

async function askLegalAI(question, jurisdiction = "India", history = []) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not set in .env — add it before using /ask"
        );
    }

    if (!question || !question.trim()) {
        throw new Error("A legal question is required");
    }

    const selectedJurisdiction =
        jurisdiction && jurisdiction.trim()
            ? jurisdiction.trim()
            : "India";

    // Keep only the last few exchanges, and only well-formed ones, so a
    // bad/huge history array can't blow up the request.
    const MAX_HISTORY_TURNS = 6;
    const safeHistory = Array.isArray(history)
        ? history
              .filter(
                  (turn) =>
                      turn &&
                      typeof turn.question === "string" &&
                      turn.question.trim() &&
                      typeof turn.answer === "string" &&
                      turn.answer.trim()
              )
              .slice(-MAX_HISTORY_TURNS)
        : [];

    const userContent = `
Jurisdiction: ${selectedJurisdiction}

Question:
${question.trim()}

IMPORTANT:
Answer according to the selected jurisdiction.

If the jurisdiction is India:
- Use Indian law only.
- Do not use U.S. law or UCC.
- Use current Indian law.
- Do not invent sections or citations.
- Cite each significant legal proposition where reliable authority is available.
- Do not guarantee a remedy.
- Use "may seek", "may be available", or "may depend on the circumstances" where appropriate.
- Distinguish a person's ability to seek a remedy from the final decision of an authority.
- Do not describe a legal notice as mandatory unless legally required.
- Do not overstate e-commerce rules.
- This may be a follow-up question. Use the prior conversation turns (if any)
  for context, but only rely on facts actually stated there — do not invent
  facts that weren't given.
- Return valid JSON only.
`;

    const GEMINI_MODEL = "gemini-3.1-flash-lite";
    const MAX_RETRIES = 3;

    async function callGemini() {
        return fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [
                            {
                                text: SYSTEM_PROMPT,
                            },
                        ],
                    },

                    contents: [
                        ...safeHistory.flatMap((turn) => [
                            {
                                role: "user",
                                parts: [{ text: turn.question.trim() }],
                            },
                            {
                                role: "model",
                                parts: [{ text: turn.answer.trim() }],
                            },
                        ]),
                        {
                            role: "user",
                            parts: [
                                {
                                    text: userContent,
                                },
                            ],
                        },
                    ],

                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.1,
                        maxOutputTokens: 4096,
                    },
                }),
            }
        );
    }

    let response;
    let lastErrText = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        response = await callGemini();

        if (response.ok) {
            break;
        }

        lastErrText = await response.text();
        console.error(
            `Gemini API error (attempt ${attempt}/${MAX_RETRIES}):`,
            lastErrText
        );

        // Only retry on transient overload/rate-limit errors.
        const transient =
            response.status === 503 || response.status === 429;

        if (!transient || attempt === MAX_RETRIES) {
            throw new Error(
                `Gemini API error (${response.status}): ${lastErrText}`
            );
        }

        // Backoff before retrying: 1s, then 2s.
        await new Promise((resolve) =>
            setTimeout(resolve, attempt * 1000)
        );
    }

    const data = await response.json();

    const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("No text response from AI");
    }

    let parsed;

    try {
        parsed = JSON.parse(text);
    } catch (error) {
        console.error("Invalid AI JSON:", text);
        throw new Error("AI response was not valid JSON");
    }

    if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
    ) {
        throw new Error("AI response has an invalid structure");
    }

    if (
        typeof parsed.answer !== "string" ||
        !parsed.answer.trim()
    ) {
        throw new Error("AI response is missing a valid answer");
    }

    if (!Array.isArray(parsed.citations)) {
        throw new Error(
            "AI response is missing a valid citations array"
        );
    }

    parsed.citations = parsed.citations
        .filter((citation) => {
            return (
                citation &&
                typeof citation === "object" &&
                !Array.isArray(citation) &&
                typeof citation.label === "string" &&
                citation.label.trim() !== "" &&
                typeof citation.note === "string" &&
                citation.note.trim() !== ""
            );
        })
        .map((citation) => ({
            label: citation.label.trim(),
            note: citation.note.trim(),
        }));

    if (
        typeof parsed.disclaimer !== "string" ||
        !parsed.disclaimer.trim()
    ) {
        parsed.disclaimer =
            "This information is for general informational purposes only and is not a substitute for advice from a qualified lawyer.";
    }

    return {
        answer: parsed.answer.trim(),
        citations: parsed.citations,
        disclaimer: parsed.disclaimer.trim(),
    };
}

module.exports = {
    askLegalAI,
};