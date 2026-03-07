import os
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Cache the cascade to avoid hitting the models list endpoint excessively
_CASCADE_CACHE = None

def _score_model(model_name: str) -> float:
    name = model_name.lower().replace("models/", "")
    score = 0.0

    if "flash-lite" in name:
        score = 25
    elif "pro" in name:
        score = 100
    elif "lite" in name:
        score = 25
    elif "flash" in name:
        score = 50
    else:
        score = 10

    version_score = 1.0
    import re
    version_match = re.search(r"(\d+)\.(\d+)", name)
    if version_match:
        major = int(version_match.group(1))
        minor = int(version_match.group(2))
        version_score = major + (minor * 0.1)
    elif re.search(r"gemini-(\d+)-", name):
        major = int(re.search(r"gemini-(\d+)-", name).group(1))
        version_score = float(major)
    elif "latest" in name:
        version_score = 2.5

    score *= version_score

    if "preview" in name:
        score *= 1.05
    if "exp" in name:
        score *= 0.85

    return round(score, 2)

def get_dynamic_cascade(api_key: str) -> list:
    global _CASCADE_CACHE
    if _CASCADE_CACHE:
        return _CASCADE_CACHE

    try:
        genai.configure(api_key=api_key)
        models = [m.name.replace("models/", "") for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        scored = [(name, _score_model(name)) for name in models]
        scored.sort(key=lambda x: x[1], reverse=True)
        sorted_models = [n for n, s in scored]

        pros = [m for m in sorted_models if "pro" in m]
        flash_lites = [m for m in sorted_models if "flash-lite" in m]
        flashes = [m for m in sorted_models if "flash" in m and "lite" not in m]

        best_pro = pros[0] if pros else "gemini-3.1-pro-preview"
        best_flash_lite = flash_lites[0] if flash_lites else "gemini-3.1-flash-lite-preview"
        fallback_pro = pros[1] if len(pros) > 1 else "gemini-2.5-pro"
        fallback_flash = flashes[0] if flashes else "gemini-2.5-flash"

        _CASCADE_CACHE = [best_pro, best_flash_lite, fallback_pro, fallback_flash]
        return _CASCADE_CACHE
    except Exception as e:
        logger.error(f"Failed to fetch model cascade dynamically: {e}")
        return ["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]

def generate_with_fallback(api_key: str, initial_model: str, contents, system_instruction: str = None, response_schema=None, response_mime_type=None):
    """
    Executes a Gemini generation request, automatically falling back across model tiers
    on 429 quota/rate limits or 503 service issues.
    """
    cascade = get_dynamic_cascade(api_key)
    
    # Ensure requested model is our starting point
    start_index = cascade.index(initial_model) if initial_model in cascade else 0
    
    last_error = None
    
    for i in range(start_index, len(cascade)):
        model_name = cascade[i]
        try:
            logger.info(f"Attempting generation with {model_name}...")
            # Automatically apply Google Search tools to 2.5 models as paid fallback feature for grounding
            tools = "google_search" if model_name.startswith("gemini-2.5") else None
            
            # Use strict Pydantic/typing parameters dynamically based on args presence
            kwargs = {}
            if response_schema or response_mime_type:
                kwargs["generation_config"] = genai.GenerationConfig(
                    response_mime_type=response_mime_type,
                    response_schema=response_schema
                )

            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction,
                tools=tools
            )
            
            # --- CONTEXT CACHING FOR 2.5 MODELS ON MASSIVE PAYLOADS --- #
            token_count = 0
            try:
                # Approximate token count safely
                token_count = model.count_tokens(contents).total_tokens
            except Exception:
                pass
                
            if token_count > 32000 and model_name.startswith("gemini-2.5"):
                logger.info(f"Payload > 32k tokens ({token_count}). Engaging Context Caching API for {model_name}.")
                try:
                    import datetime
                    
                    cache = genai.caching.CachedContent.create(
                        model=model_name,
                        system_instruction=system_instruction,
                        contents=contents,
                        ttl=datetime.timedelta(minutes=15)
                    )
                    
                    cached_model = genai.GenerativeModel.from_cached_content(
                        cached_content=cache,
                        tools=tools
                    )
                    
                    response = cached_model.generate_content("Synthesize and process the cached payload.", **kwargs)
                    
                    # Cleanup cache immediately to save user costs
                    cache.delete()
                    return response, model_name
                    
                except Exception as cache_err:
                    logger.warning(f"Failed to implement Context Caching: {cache_err}. Proceeding with standard generation.")
            
            response = model.generate_content(contents, **kwargs)
            return response, model_name
        except Exception as e:
            error_str = str(e).lower()
            last_error = e
            if "429" in error_str or "503" in error_str or "quota" in error_str or "exhausted" in error_str:
                logger.warning(f"Model {model_name} failed with rate limit/unavailable. Falling back... Error: {e}")
                continue
            else:
                # E.g. 400 Bad Request, API Key invalid -> immediately throw
                raise e
    
    raise RuntimeError(f"All models in fallback cascade failed due to rate limits. Last error: {last_error}")
