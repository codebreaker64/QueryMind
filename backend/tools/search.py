"""
search.py — web_search() → Tavily, parallel with rate limiting.

Calls the Tavily search API, strips HTML boilerplate, and returns
clean semantic text. Supports parallel calls with asyncio.Semaphore(3)
and adds a randomised 1–2 second delay between requests.
"""

import asyncio
import os
import random
import re

from tavily import TavilyClient

# Rate-limiting semaphore: max 3 concurrent searches
_search_semaphore = asyncio.Semaphore(3)

# Tavily client (initialized lazily)
_client: TavilyClient | None = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        api_key = os.environ.get("TAVILY_API_KEY", "")
        if not api_key:
            raise RuntimeError("TAVILY_API_KEY environment variable is not set")
        _client = TavilyClient(api_key=api_key)
    return _client


def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _truncate_tokens(text: str, max_tokens: int = 500) -> str:
    """Rough truncation to ~max_tokens (word-based approximation)."""
    words = text.split()
    if len(words) <= max_tokens:
        return text
    return " ".join(words[:max_tokens]) + "…"


async def web_search(query: str) -> str:
    """
    Search the web using Tavily and return clean, formatted results.

    Args:
        query: The search query string.

    Returns:
        A formatted string containing search results with titles, URLs,
        and content snippets.
    """
    async with _search_semaphore:
        # Random delay to avoid anti-bot detection
        delay = random.uniform(1.0, 2.0)
        await asyncio.sleep(delay)

        # Run the synchronous Tavily client in a thread pool
        client = _get_client()
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.search(
                query=query,
                search_depth="advanced",
                max_results=5,
            ),
        )

    # Format results
    results = response.get("results", [])
    if not results:
        return f"No results found for: {query}"

    formatted_parts = []
    for i, result in enumerate(results, 1):
        title = result.get("title", "Untitled")
        url = result.get("url", "")
        content = result.get("content", "")

        # Clean up content
        content = _strip_html(content)
        content = _truncate_tokens(content, max_tokens=500)

        formatted_parts.append(
            f"[{i}] {title}\n"
            f"    URL: {url}\n"
            f"    {content}\n"
        )

    return "\n".join(formatted_parts)
