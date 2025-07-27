import sqlite3
from pymongo import MongoClient
from bson import ObjectId

# SQLite setup
SQLITE_DB = 'users.db'

# MongoDB setup
MONGO_URI = "mongodb+srv://icarus:t9WWh6jgnbym9PvC@icarus.0qptcoc.mongodb.net/?retryWrites=true&w=majority&appName=icarus"
MONGO_DB = "proctoring_system"

def migrate_users(sql_conn, mongo_db):
    cursor = sql_conn.execute("SELECT * FROM users")
    users = []
    for row in cursor:
        users.append({
            "username": row["username"],
            "password": row["password"],
            "salt": row["salt"],
            "role": row["role"]
        })
    if users:
        mongo_db.users.insert_many(users)
        print(f"Migrated {len(users)} users.")

def migrate_tests(sql_conn, mongo_db):
    cursor = sql_conn.execute("SELECT * FROM tests")
    tests = []
    sqlite_id_to_mongo_id = {}

    for row in cursor:
        doc = {
            "test_code": row["test_code"],
            "questions": row["questions"],
            "timer": row["timer"],
            "is_test_started": bool(row["is_test_started"])
        }
        result = mongo_db.tests.insert_one(doc)
        sqlite_id_to_mongo_id[row["id"]] = result.inserted_id

    print(f"Migrated {len(sqlite_id_to_mongo_id)} tests.")
    return sqlite_id_to_mongo_id

def migrate_sessions(sql_conn, mongo_db, test_id_map):
    cursor = sql_conn.execute("SELECT * FROM user_test_sessions")
    sessions = []
    for row in cursor:
        sessions.append({
            "username": row["username"],
            "test_id": test_id_map.get(row["test_id"]),
            "answers": row["answers"],
            "ip_address": row["ip_address"],
            "session_login": row["session_login"]
        })
    if sessions:
        mongo_db.user_test_sessions.insert_many(sessions)
        print(f"Migrated {len(sessions)} user test sessions.")

def migrate_events(sql_conn, mongo_db, test_id_map):
    cursor = sql_conn.execute("SELECT * FROM suspicious_events")
    events = []
    for row in cursor:
        events.append({
            "username": row["username"],
            "test_id": test_id_map.get(row["test_id"]),
            "timestamp": row["timestamp"],
            "event_type": row["event_type"],
            "frame_path": row["frame_path"]
        })
    if events:
        mongo_db.suspicious_events.insert_many(events)
        print(f"Migrated {len(events)} suspicious events.")

def main():
    # Connect to SQLite
    sql_conn = sqlite3.connect(SQLITE_DB)
    sql_conn.row_factory = sqlite3.Row

    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    mongo_db = client[MONGO_DB]

    # Clear MongoDB collections to avoid duplication
    mongo_db.users.delete_many({})
    mongo_db.tests.delete_many({})
    mongo_db.user_test_sessions.delete_many({})
    mongo_db.suspicious_events.delete_many({})

    print("Starting migration...")

    # Migrate step by step
    migrate_users(sql_conn, mongo_db)
    test_id_map = migrate_tests(sql_conn, mongo_db)
    migrate_sessions(sql_conn, mongo_db, test_id_map)
    migrate_events(sql_conn, mongo_db, test_id_map)

    print("✅ Migration completed successfully!")

    sql_conn.close()

if __name__ == "__main__":
    main()
