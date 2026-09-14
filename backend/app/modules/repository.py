import sqlite3
import json
import numpy

def get_connection():
    conn = sqlite3.connect('knowledge_inbox.db')
    return conn

def insert_source_data(source_type: str, title: str, content: str, url: str = ""):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO source_list (source_type, title, content, url)
            VALUES (?, ?, ?, ?) RETURNING id
            """,
            (source_type, title, content, url)
        )
        source_id = cur.fetchone()
        conn.commit()
        return source_id[0]
            
    except Exception as e:
        conn.rollback()
        print(f"Error inserting source data: {str(e)}")
        raise e
        
    finally:
        conn.close()


def insert_chunk_data(source_id: int, data: list ):
    if not data or not source_id:
        return []

    conn = get_connection()
    inserted_ids = []

    try:
        cur = conn.cursor()

        chunk_tuples = []
        for c in data:
            chunk_tuples.extend([
                source_id, 
                c['chunk'], 
                c['vector']
            ])

        values = ", ".join(["(?, ?, ?)"] * len(data))
        sql = f"""
                    INSERT INTO source_chunks (source_id, chunk_text, chunk_vector)
                    VALUES {values} RETURNING id
                    """

        cur.execute(sql, chunk_tuples)

        inserted_ids = [row[0] for row in cur.fetchall()]
        conn.commit()

        return inserted_ids

    except Exception as e:
        conn.rollback()
        print(f"Error inserting chunk batch for source {source_id}: {str(e)}")
        raise e

    finally:
        conn.close()


def get_vectors_list():
    conn = get_connection()

    try:
        cur = conn.cursor()

        cur.execute(""" SELECT * FROM source_chunks; """)

        data = cur.fetchall()

        result = []
        for row in data:
            vector = numpy.array(json.loads(row[3]))
            result.append({
                'id':row[0],
                'source_id':row[1],
                'chunk_text':row[2],
                'chunk_vector':vector
            })
        return result

    except Exception as e:
            conn.rollback()
            print(f"Error fetching chunk vectors: {str(e)}")
            raise e
    
    finally:
        conn.close()


def get_all_sources(ids=[]):
    conn = get_connection()
    try:
        cur = conn.cursor()
        sql = "SELECT id, source_type, title, url, content, created_at FROM source_list"
        if ids:
            values = ", ".join(["?"]*len(ids))
            sql += f" WHERE id IN ({values})"

        sql +=" ORDER BY id DESC;"

        cur.execute(sql,ids)

        rows = cur.fetchall()
        return [
            {"id": r[0], "source_type": r[1], "title": r[2],"url":r[3], "content":r[4], "created_at": r[5]} 
            for r in rows
        ]
    finally:
        conn.close()




def get_existing_source(source_type: str, url: str = "", content: str = "", title: str = ""):
    conn = get_connection()
    try:
        cur = conn.cursor()
        
        if source_type == "url" and url:
            cur.execute("SELECT id FROM source_list WHERE url = ? LIMIT 1;", (url,))
            row = cur.fetchone()
            if row:
                return row[0]

        if content:
            cur.execute("SELECT id FROM source_list WHERE content LIKE ? LIMIT 1;", (content,))
            row = cur.fetchone()
            if row:
                return row[0]

        if title:
            cur.execute("SELECT id FROM source_list WHERE title = ? LIMIT 1;", (title,))
            row = cur.fetchone()
            if row:
                return row[0]

        return None

    finally:
        conn.close()

    