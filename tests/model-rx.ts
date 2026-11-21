// The pattern that identifies a hardcoded model name or version. Kept in one place (excluded from its own scan).
export const MODEL_RX = new RegExp(["(claude|gemini|gpt)[-_ ]?[0-9]", "(claude|gemini)-(opus|sonnet|haiku|pro|flash)", "\\b(opus|sonnet|haiku)\\b"].join("|"), "i");
