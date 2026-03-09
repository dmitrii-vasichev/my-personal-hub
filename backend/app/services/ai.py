"""
Multi-provider LLM client factory.
Adapters share a common interface: generate(system_prompt, user_prompt) -> str
"""
from typing import Protocol


class LLMAdapter(Protocol):
    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        ...


class OpenAIAdapter:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        import openai
        self._client = openai.AsyncOpenAI(api_key=api_key)
        self._model = model

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content or ""


class AnthropicAdapter:
    def __init__(self, api_key: str, model: str = "claude-haiku-4-5-20251001"):
        import anthropic
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text if response.content else ""


class GeminiAdapter:
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(
            model_name=model,
            system_instruction=None,  # set per-call
        )
        self._model_name = model

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        import google.generativeai as genai
        import asyncio
        model = genai.GenerativeModel(
            model_name=self._model_name,
            system_instruction=system_prompt,
        )
        response = await asyncio.to_thread(
            model.generate_content,
            user_prompt,
            generation_config={"temperature": 0.3},
        )
        return response.text or ""


def get_llm_client(provider: str, api_key: str) -> "LLMAdapter":
    """Factory — returns the appropriate adapter for the given provider."""
    if provider == "openai":
        return OpenAIAdapter(api_key)
    elif provider == "anthropic":
        return AnthropicAdapter(api_key)
    elif provider == "gemini":
        return GeminiAdapter(api_key)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
