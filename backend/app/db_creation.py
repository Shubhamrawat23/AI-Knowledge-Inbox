import sqlite3

con = sqlite3.connect("knowledge_inbox.db")
cur = con.cursor()


cur.execute('''CREATE TABLE IF NOT EXISTS source_list 
                (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_type TEXT NOT NULL CHECK(source_type IN ('note', 'url')),
                    url TEXT DEFAULT NULL,
                    title TEXT DEFAULT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''');

cur.execute('''
            CREATE TABLE IF NOT EXISTS source_chunks 
            (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER NOT NULL,
                chunk_text TEXT NOT NULL,
                chunk_vector TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (source_id) REFERENCES source_list (id)
            ) 
        ''');

con.commit();
con.close();