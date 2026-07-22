import type {
  AiProvider,
  AiProviderDefinition,
} from "../interfaces/ai-provider";

export class ProviderRegistry {
  private readonly providers = new Map<string, unknown>();
  private readonly definitions = new Map<string, AiProviderDefinition>();

  register<TRequest, TResponse>(
    provider: AiProvider<TRequest, TResponse>,
  ): void {
    const { id } = provider.definition;

    if (this.providers.has(id)) {
      throw new Error(`AI provider "${id}" is already registered.`);
    }

    this.providers.set(id, provider);
    this.definitions.set(id, provider.definition);
  }

  resolve<TRequest, TResponse>(
    providerId: string,
  ): AiProvider<TRequest, TResponse> {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`AI provider "${providerId}" is not registered.`);
    }

    return provider as AiProvider<TRequest, TResponse>;
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  list(): ReadonlyArray<AiProviderDefinition> {
    return Array.from(this.definitions.values());
  }
}
