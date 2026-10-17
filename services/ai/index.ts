
import { MockAIProvider } from "./mock-provider";
import { OllamaAIProvider } from "./ollama-provider";
import type {
  AIProvider,
  ContentRepurposingProvider,
} from "./provider";

export function getAIProvider(): AIProvider &
  ContentRepurposingProvider {
  const provider =
    process.env.NEXT_PUBLIC_AI_PROVIDER || "mock";

  console.log("🔥 AI PROVIDER:", provider);

  switch (provider) {
    case "ollama":
      console.log("🔥 USING OLLAMA PROVIDER");
      return new OllamaAIProvider();

    case "mock":
    default:
      console.log("🔥 USING MOCK PROVIDER");
      return new MockAIProvider() as AIProvider &
        ContentRepurposingProvider;
  }
}
