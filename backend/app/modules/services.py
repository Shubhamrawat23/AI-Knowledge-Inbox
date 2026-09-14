from fastapi import HTTPException
from app.utils import external_services as extSer
from app.modules import repository
import json
import numpy

async def save_data(data):

    response = {
        'status':'success',
        'code':200,
        'message':"Source saved successfully",
        'data':None,
        'error':None
    }
    if data.source_type == "url":
        source_type = "url"
    else: 
        source_type="note"

    if source_type == "url":
        target_url = data.url
    else: 
        target_url= ""
    if source_type == "note":
        target_content = data.content
    else: 
        target_content=""
    target_title = data.title or ""

    existing_id = repository.get_existing_source(
        source_type=source_type,
        url=target_url,
        content=target_content,
        title=target_title,
    )

    if existing_id:
        return {
            "status": "success",
            "code": 200,
            "message": (
                "Source with matching Title, URL or Content already exists."
            ),
            "data": {"source_id": existing_id, "is_duplicate": True},
            "error": None,
        }

    all_chunk_ids=[]
    if data.source_type == 'url':
        web_scrappin_data = await extSer.webScrapping(data.url)

        # insert in source data in table
        source_id = repository.insert_source_data(data.source_type, web_scrappin_data['title'] or '', web_scrappin_data['raw_text'] or '', data.url)
        data.content = web_scrappin_data['raw_text']
    else:
        source_id = repository.insert_source_data(data.source_type, data.title or "", data.content or '')

    # now make chucks of raw content
    chunk_data = extSer.get_chunks_with_embedding_vector(data.content)

    if source_id:
        all_chunk_ids = repository.insert_chunk_data(source_id, chunk_data)

    if all_chunk_ids:
        response['data'] = {
            'source_id': source_id,
            'chunks_count': len(all_chunk_ids)
            }
        return response


async def question_response(data):

    ques_vector_data = extSer.get_embedding_vector(text=data)

    chunks_vector_list = repository.get_vectors_list()

    if not chunks_vector_list:
        return "No information found in database."

    vectors_array = numpy.array([c['chunk_vector'] for c in chunks_vector_list])

    cosine_similarites = numpy.dot(vectors_array, ques_vector_data)


    for index, cosine in enumerate(cosine_similarites):
        chunks_vector_list[index]['cosine_similarity'] = float(cosine)


    top_chunks = get_top_chunks_index(chunks_vector_list)

    if not top_chunks:
        response={'answer': "I couldn't find relevant information in the sources to answer your question.",'source':[]}

        return response

    context = "\n".join([c['chunk_text'] for c in top_chunks])
    
    result = await extSer.generate_rag_answer(question=data, context_text=context)

    source_data = get_unique_source_data(top_chunks)
    response = {
        'answer': result,
        'source':source_data
    }
    return response






def get_top_chunks_index(data, threshold = 0.60, num_top_chunks = 3):

    valid_chunks = [c for c in data if c['cosine_similarity']>= threshold]

    sorted_chunks = sorted(valid_chunks, key=lambda x:x['cosine_similarity'], reverse=True)

    return sorted_chunks[0:num_top_chunks]

def get_unique_source_data(top_chunks):
    unique_ids = []
    seen = set()

    for c in top_chunks:
        if c['source_id'] not in seen:
            seen.add(c['source_id'])
            unique_ids.append(c['source_id'])

    if not unique_ids:
        return []
    source_data = repository.get_all_sources(ids=unique_ids)

    if source_data:
        return source_data

    return []



        

