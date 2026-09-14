import httpx
from trafilatura import extract
import json
from sentence_transformers import SentenceTransformer
from openai import AsyncOpenAI
from openai import APIConnectionError, APIStatusError, RateLimitError, APITimeoutError
import os
from dotenv import load_dotenv

load_dotenv()

model = SentenceTransformer('BAAI/bge-small-en-v1.5')

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

async def webScrapping(url: str):
    response = None
    async with httpx.AsyncClient() as client:
        response = await client.get(url)

        if response.status_code == 200:
            json_data = extract(response.text, output_format="json", with_metadata=True)

        parse_data = json.loads(json_data)
        print(parse_data)

    return {
        'raw_text': parse_data.get('text') or '',
        'title': parse_data.get('title') or '',
    } 
#asyncio.run( webScrapping('https://mitjamartini.com/posts/python-httpx-get/'))


def get_chunks_with_embedding_vector(raw_txt, words_in_chunk= 400):
    if not raw_txt:
        return []
    
    chunk_items = []
    words = raw_txt.split()
    total_words = len(words)

    start = 0

    while(start<total_words):
        end = start+words_in_chunk
        chunk = " ".join(words[start:end])
        item = {
            'chunk':chunk
        }
        chunk_items.append(item)
        start = (words_in_chunk//2)+start
    print(chunk_items)

    data = get_embedding_vector(chunk_items)

    return data



def get_embedding_vector(chunks_list=[], text=""):

    if chunks_list:
        all_chunk_txt = [c['chunk'] for c in chunks_list]

        vector_data = model.encode(all_chunk_txt, normalize_embeddings=True)

        for index, c in enumerate(chunks_list):
            c['vector'] = json.dumps(vector_data[index].tolist())

        return chunks_list
    elif text:
        ques_vector = model.encode(text, normalize_embeddings=True)

        return ques_vector
    
    return []



async def generate_rag_answer(question: str, context_text: str):
    system_prompt = (
        "You are a helpful AI assistant answering questions using saved personal notes.\n"
        "Rules:\n"
        "1. Answer the user's question using ONLY the provided Source Context below.\n"
        "2. If the context does not contain enough info, state clearly: "
        "'I couldn't find relevant information in your saved sources to answer this question.'\n"
        "3. Keep the response direct, grounded, and clear."
    )

    user_prompt = f"Source Context:\n{context_text}\n\nQuestion: {question}"

    try:
        response = await client.chat.completions.create(
            model="nvidia/nemotron-3-super-120b-a12b:free",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
        )
        
        if not response.choices:
            error_info = getattr(response, "error", "Service unavailable")
            raise APIStatusError(f"OpenRouter upstream error: {error_info}")
        return response.choices[0].message.content


    except RateLimitError:
        raise
    except APIConnectionError:
        raise
    except APIStatusError:
        raise
    except APITimeoutError:
        raise

    except Exception as e:
        print(f"OpenRouter Connection Error: {str(e)}")
        return f"Error contacting OpenRouter API: {str(e)}"
        

