import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pymysql
from flask import Flask, jsonify, request, send_from_directory, session
from pymysql.cursors import DictCursor
from werkzeug.security import check_password_hash, generate_password_hash


ROOT_DIR = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT_DIR / "assets"


def env(name, default=""):
    return os.environ.get(name, default)


DB_CONFIG = {
    "host": env("FRESHTRACK_DB_HOST", "127.0.0.1"),
    "port": int(env("FRESHTRACK_DB_PORT", "3306")),
    "user": env("FRESHTRACK_DB_USER", "root"),
    "password": env("FRESHTRACK_DB_PASSWORD", ""),
    "database": env("FRESHTRACK_DB_NAME", "freshtrack"),
    "charset": "utf8mb4",
    "cursorclass": DictCursor,
    "autocommit": True,
}


app = Flask(__name__)
app.secret_key = env("FRESHTRACK_SECRET_KEY", "freshtrack-dev-secret-key")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)


def connect(include_database=True):
    config = DB_CONFIG.copy()
    if not include_database:
      config.pop("database", None)
    return pymysql.connect(**config)


def execute_many(statements):
    with connect(include_database=False) as connection:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)


def execute(statement, params=None, fetchone=False, fetchall=False):
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(statement, params or ())
            if fetchone:
                return cursor.fetchone()
            if fetchall:
                return cursor.fetchall()
            return cursor.lastrowid


def ensure_schema():
    db_name = DB_CONFIG["database"]
    execute_many([
        f"CREATE DATABASE IF NOT EXISTS `{db_name}` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci",
        f"USE `{db_name}`",
        """
        CREATE TABLE IF NOT EXISTS users (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          name VARCHAR(120) NOT NULL,
          email VARCHAR(180) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_users_email (email)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS foods (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          name VARCHAR(160) NOT NULL,
          category ENUM('Vegetables', 'Fruits', 'Meat', 'Dairy', 'Grains', 'Other') NOT NULL DEFAULT 'Other',
          quantity INT UNSIGNED NOT NULL DEFAULT 1,
          unit VARCHAR(40) NOT NULL DEFAULT 'item',
          location ENUM('Fridge', 'Freezer', 'Pantry', 'Counter', 'Other') NOT NULL DEFAULT 'Pantry',
          purchase_date DATE NOT NULL,
          expiry_date DATE NOT NULL,
          price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          status ENUM('available', 'eaten', 'expired', 'discarded', 'donated') NOT NULL DEFAULT 'available',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_foods_user_id (user_id),
          KEY idx_foods_expiry_date (expiry_date),
          KEY idx_foods_status (status),
          CONSTRAINT fk_foods_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS recipes (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          title VARCHAR(180) NOT NULL,
          description TEXT,
          prep_minutes INT UNSIGNED NOT NULL DEFAULT 15,
          difficulty ENUM('Easy', 'Medium', 'Hard') NOT NULL DEFAULT 'Easy',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_recipes_title (title)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          recipe_id BIGINT UNSIGNED NOT NULL,
          name VARCHAR(160) NOT NULL,
          category ENUM('Vegetables', 'Fruits', 'Meat', 'Dairy', 'Grains', 'Other') NOT NULL DEFAULT 'Other',
          PRIMARY KEY (id),
          KEY idx_recipe_ingredients_recipe_id (recipe_id),
          UNIQUE KEY uq_recipe_ingredient_name (recipe_id, name),
          CONSTRAINT fk_recipe_ingredients_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS shopping_items (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          name VARCHAR(160) NOT NULL,
          category ENUM('Vegetables', 'Fruits', 'Meat', 'Dairy', 'Grains', 'Other') NOT NULL DEFAULT 'Other',
          quantity INT UNSIGNED NOT NULL DEFAULT 1,
          source VARCHAR(120) NOT NULL DEFAULT 'manual',
          done BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_shopping_user_id (user_id),
          CONSTRAINT fk_shopping_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS waste_logs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          food_id BIGINT UNSIGNED NULL,
          food_name VARCHAR(160) NOT NULL,
          category ENUM('Vegetables', 'Fruits', 'Meat', 'Dairy', 'Grains', 'Other') NOT NULL DEFAULT 'Other',
          quantity INT UNSIGNED NOT NULL DEFAULT 1,
          unit VARCHAR(40) NOT NULL DEFAULT 'item',
          price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          outcome ENUM('eaten', 'expired', 'discarded', 'donated') NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_waste_logs_user_id (user_id),
          KEY idx_waste_logs_outcome (outcome),
          CONSTRAINT fk_waste_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          CONSTRAINT fk_waste_logs_food FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE SET NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS activities (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          type VARCHAR(40) NOT NULL,
          message VARCHAR(255) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_activities_user_id (user_id),
          CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """,
    ])
    seed_data()


def seed_data():
    admin_id = upsert_user("FreshTrack Admin", "admin@freshtrack.local", "Admin123!", "admin")
    demo_id = upsert_user("Mia Household", "mia@example.com", "Demo123!", "user")
    ben_id = upsert_user("Ben Household", "ben@example.com", "Demo123!", "user")

    recipes = [
        ("Use-Soon Vegetable Omelette", "A fast meal that uses vegetables and dairy close to expiry.", 15, "Easy"),
        ("Leftover Fried Rice", "A flexible recipe for grains, vegetables, eggs, and leftover protein.", 20, "Easy"),
        ("Pantry Rescue Soup", "A simple soup for mixed produce, grains, dairy, or meat close to expiry.", 30, "Easy"),
        ("Fruit Yogurt Bowl", "A no-cook option for fruit and dairy that should be used soon.", 8, "Easy"),
        ("Quick Pantry Wrap", "A light lunch using vegetables, dairy, grains, or leftover protein.", 12, "Easy"),
    ]
    for recipe in recipes:
        execute(
            """
            INSERT INTO recipes (title, description, prep_minutes, difficulty)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              description = VALUES(description),
              prep_minutes = VALUES(prep_minutes),
              difficulty = VALUES(difficulty)
            """,
            recipe,
        )

    recipe_ingredients = {
        "Use-Soon Vegetable Omelette": [("Eggs", "Dairy"), ("Tomato", "Vegetables"), ("Spinach", "Vegetables"), ("Cheese", "Dairy")],
        "Leftover Fried Rice": [("Rice", "Grains"), ("Carrot", "Vegetables"), ("Eggs", "Dairy"), ("Chicken", "Meat")],
        "Pantry Rescue Soup": [("Potato", "Vegetables"), ("Carrot", "Vegetables"), ("Chicken", "Meat"), ("Milk", "Dairy")],
        "Fruit Yogurt Bowl": [("Yogurt", "Dairy"), ("Banana", "Fruits"), ("Apple", "Fruits")],
        "Quick Pantry Wrap": [("Tortilla", "Grains"), ("Lettuce", "Vegetables"), ("Cheese", "Dairy"), ("Chicken", "Meat")],
    }
    for title, ingredients in recipe_ingredients.items():
        recipe = execute("SELECT id FROM recipes WHERE title = %s", (title,), fetchone=True)
        for name, category in ingredients:
            execute(
                """
                INSERT INTO recipe_ingredients (recipe_id, name, category)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE category = VALUES(category)
                """,
                (recipe["id"], name, category),
            )

    if admin_id:
        log_activity(admin_id, "system", "Admin account is ready.")
    if execute("SELECT COUNT(*) AS total FROM foods WHERE user_id = %s", (demo_id,), fetchone=True)["total"] == 0:
        today = date.today()
        demo_foods = [
            (demo_id, "Spinach", "Vegetables", 1, "bag", "Fridge", today - timedelta(days=3), today + timedelta(days=1), 3.20),
            (demo_id, "Yogurt", "Dairy", 2, "cups", "Fridge", today - timedelta(days=5), today + timedelta(days=3), 4.50),
            (demo_id, "Rice", "Grains", 1, "pack", "Pantry", today - timedelta(days=10), today + timedelta(days=40), 6.90),
        ]
        for food in demo_foods:
            execute(
                """
                INSERT INTO foods
                  (user_id, name, category, quantity, unit, location, purchase_date, expiry_date, price)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                food,
            )
        log_activity(demo_id, "system", "Demo pantry data was prepared for Mia Household.")

    if execute("SELECT COUNT(*) AS total FROM foods WHERE user_id = %s", (ben_id,), fetchone=True)["total"] == 0:
        today = date.today()
        execute(
            """
            INSERT INTO foods
              (user_id, name, category, quantity, unit, location, purchase_date, expiry_date, price)
            VALUES (%s, 'Chicken', 'Meat', 1, 'pack', 'Freezer', %s, %s, 8.80)
            """,
            (ben_id, today - timedelta(days=2), today + timedelta(days=5)),
        )


def upsert_user(name, email, password, role):
    existing = execute("SELECT * FROM users WHERE email = %s", (email,), fetchone=True)
    password_hash = generate_password_hash(password)
    if not existing:
        return execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (name, email, password_hash, role),
        )
    needs_password_fix = False
    try:
        check_password_hash(existing["password_hash"], password)
    except ValueError:
        needs_password_fix = True
    if role == "admin" or needs_password_fix:
        execute(
            """
            UPDATE users
            SET name = %s,
                password_hash = CASE WHEN %s THEN %s ELSE password_hash END,
                role = %s
            WHERE id = %s
            """,
            (name, needs_password_fix, password_hash, role, existing["id"]),
        )
    return existing["id"]


def api_error(message, status=400):
    response = jsonify({"message": message})
    response.status_code = status
    return response


def serialize_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def serialize_row(row):
    return {key: serialize_value(value) for key, value in row.items()}


def serialize_user(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "createdAt": serialize_value(row.get("created_at")),
    }


def serialize_food(row):
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "name": row["name"],
        "category": row["category"],
        "quantity": row["quantity"],
        "unit": row["unit"],
        "location": row["location"],
        "purchaseDate": serialize_value(row["purchase_date"]),
        "expiryDate": serialize_value(row["expiry_date"]),
        "price": serialize_value(row["price"]),
        "status": row["status"],
        "createdAt": serialize_value(row["created_at"]),
        "updatedAt": serialize_value(row["updated_at"]),
    }


def serialize_recipe(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "prepMinutes": row["prep_minutes"],
        "difficulty": row["difficulty"],
    }


def serialize_recipe_ingredient(row):
    return {
        "id": row["id"],
        "recipeId": row["recipe_id"],
        "name": row["name"],
        "category": row["category"],
    }


def serialize_shopping_item(row):
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "name": row["name"],
        "category": row["category"],
        "quantity": row["quantity"],
        "source": row["source"],
        "done": bool(row["done"]),
        "createdAt": serialize_value(row["created_at"]),
    }


def serialize_waste_log(row):
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "foodId": row["food_id"],
        "foodName": row["food_name"],
        "category": row["category"],
        "quantity": row["quantity"],
        "unit": row["unit"],
        "price": serialize_value(row["price"]),
        "outcome": row["outcome"],
        "createdAt": serialize_value(row["created_at"]),
    }


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return execute("SELECT * FROM users WHERE id = %s", (user_id,), fetchone=True)


def require_user():
    user = current_user()
    if not user:
        return None, api_error("Please log in first.", 401)
    return user, None


def require_admin():
    user, error = require_user()
    if error:
        return None, error
    if user["role"] != "admin":
        return None, api_error("Admin permission is required.", 403)
    return user, None


def log_activity(user_id, activity_type, message):
    execute(
        "INSERT INTO activities (user_id, type, message) VALUES (%s, %s, %s)",
        (user_id, activity_type, message),
    )


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response


@app.route("/api/<path:_path>", methods=["OPTIONS"])
def handle_options(_path):
    return ("", 204)


@app.route("/")
def index():
    return send_from_directory(ROOT_DIR, "index.html")


@app.route("/assets/<path:path>")
def assets(path):
    return send_from_directory(ASSETS_DIR, path)


@app.post("/api/auth/register")
def register():
    payload = request.get_json() or {}
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if len(name) < 2 or "@" not in email or len(password) < 6:
        return api_error("Please provide a valid name, email, and password.")
    existing = execute("SELECT id FROM users WHERE email = %s", (email,), fetchone=True)
    if existing:
        return api_error("This email is already registered.")
    user_id = execute(
        "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
        (name, email, generate_password_hash(password)),
    )
    session["user_id"] = user_id
    log_activity(user_id, "account", f"{name} registered an account.")
    user = execute("SELECT * FROM users WHERE id = %s", (user_id,), fetchone=True)
    return jsonify(serialize_user(user)), 201


@app.post("/api/auth/login")
def login():
    payload = request.get_json() or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    user = execute("SELECT * FROM users WHERE email = %s", (email,), fetchone=True)
    if not user or not check_password_hash(user["password_hash"], password):
        return api_error("Invalid email or password.", 401)
    session["user_id"] = user["id"]
    return jsonify(serialize_user(user))


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/auth/me")
def me():
    user = current_user()
    return jsonify(serialize_user(user) if user else None)


@app.get("/api/foods")
def list_foods():
    user, error = require_user()
    if error:
        return error
    if user["role"] == "admin":
        rows = execute("SELECT * FROM foods ORDER BY expiry_date ASC, id DESC", fetchall=True)
    else:
        rows = execute(
            "SELECT * FROM foods WHERE user_id = %s ORDER BY expiry_date ASC, id DESC",
            (user["id"],),
            fetchall=True,
        )
    return jsonify([serialize_food(row) for row in rows])


@app.post("/api/foods")
def create_food():
    user, error = require_user()
    if error:
        return error
    payload = request.get_json() or {}
    food_id = execute(
        """
        INSERT INTO foods
          (user_id, name, category, quantity, unit, location, purchase_date, expiry_date, price)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user["id"],
            payload.get("name"),
            payload.get("category", "Other"),
            int(payload.get("quantity") or 1),
            payload.get("unit") or "item",
            payload.get("location") or "Pantry",
            payload.get("purchaseDate"),
            payload.get("expiryDate"),
            float(payload.get("price") or 0),
        ),
    )
    log_activity(user["id"], "food", f"{payload.get('name')} was added to pantry.")
    row = execute("SELECT * FROM foods WHERE id = %s", (food_id,), fetchone=True)
    return jsonify(serialize_food(row)), 201


@app.put("/api/foods/<int:food_id>")
def update_food(food_id):
    user, error = require_user()
    if error:
        return error
    food = get_food_for_user(food_id, user)
    if not food:
        return api_error("Food record not found.", 404)
    payload = request.get_json() or {}
    new_status = payload.get("status", food["status"])
    execute(
        """
        UPDATE foods
        SET name = %s,
            category = %s,
            quantity = %s,
            unit = %s,
            location = %s,
            purchase_date = %s,
            expiry_date = %s,
            price = %s,
            status = %s
        WHERE id = %s
        """,
        (
            payload.get("name", food["name"]),
            payload.get("category", food["category"]),
            int(payload.get("quantity", food["quantity"])),
            payload.get("unit", food["unit"]),
            payload.get("location", food["location"]),
            payload.get("purchaseDate", food["purchase_date"]),
            payload.get("expiryDate", food["expiry_date"]),
            float(payload.get("price", food["price"])),
            new_status,
            food_id,
        ),
    )
    if new_status != food["status"] and new_status in {"eaten", "expired", "discarded", "donated"}:
        execute(
            """
            INSERT INTO waste_logs
              (user_id, food_id, food_name, category, quantity, unit, price, outcome)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                food["user_id"],
                food["id"],
                food["name"],
                food["category"],
                food["quantity"],
                food["unit"],
                food["price"],
                new_status,
            ),
        )
    log_activity(food["user_id"], "food", f"{food['name']} was updated.")
    row = execute("SELECT * FROM foods WHERE id = %s", (food_id,), fetchone=True)
    return jsonify(serialize_food(row))


@app.delete("/api/foods/<int:food_id>")
def delete_food(food_id):
    user, error = require_user()
    if error:
        return error
    food = get_food_for_user(food_id, user)
    if not food:
        return api_error("Food record not found.", 404)
    execute("DELETE FROM foods WHERE id = %s", (food_id,))
    log_activity(food["user_id"], "food", f"{food['name']} was deleted.")
    return jsonify(serialize_food(food))


def get_food_for_user(food_id, user):
    if user["role"] == "admin":
        return execute("SELECT * FROM foods WHERE id = %s", (food_id,), fetchone=True)
    return execute(
        "SELECT * FROM foods WHERE id = %s AND user_id = %s",
        (food_id, user["id"]),
        fetchone=True,
    )


@app.get("/api/recipes")
def list_recipes():
    user, error = require_user()
    if error:
        return error
    recipes = execute("SELECT * FROM recipes ORDER BY title", fetchall=True)
    ingredients = execute("SELECT * FROM recipe_ingredients ORDER BY recipe_id, id", fetchall=True)
    return jsonify({
        "recipes": [serialize_recipe(row) for row in recipes],
        "ingredients": [serialize_recipe_ingredient(row) for row in ingredients],
    })


@app.get("/api/waste-logs")
def list_waste_logs():
    user, error = require_user()
    if error:
        return error
    if user["role"] == "admin":
        rows = execute("SELECT * FROM waste_logs ORDER BY created_at DESC", fetchall=True)
    else:
        rows = execute(
            "SELECT * FROM waste_logs WHERE user_id = %s ORDER BY created_at DESC",
            (user["id"],),
            fetchall=True,
        )
    return jsonify([serialize_waste_log(row) for row in rows])


@app.get("/api/shopping-items")
def list_shopping_items():
    user, error = require_user()
    if error:
        return error
    rows = execute(
        "SELECT * FROM shopping_items WHERE user_id = %s ORDER BY done ASC, id DESC",
        (user["id"],),
        fetchall=True,
    )
    return jsonify([serialize_shopping_item(row) for row in rows])


@app.post("/api/shopping-items")
def create_shopping_item():
    user, error = require_user()
    if error:
        return error
    payload = request.get_json() or {}
    item_id = execute(
        """
        INSERT INTO shopping_items (user_id, name, category, quantity, source)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            user["id"],
            payload.get("name"),
            payload.get("category", "Other"),
            int(payload.get("quantity") or 1),
            payload.get("source", "manual"),
        ),
    )
    row = execute("SELECT * FROM shopping_items WHERE id = %s", (item_id,), fetchone=True)
    return jsonify(serialize_shopping_item(row)), 201


@app.patch("/api/shopping-items/<int:item_id>/toggle")
def toggle_shopping_item(item_id):
    user, error = require_user()
    if error:
        return error
    item = execute(
        "SELECT * FROM shopping_items WHERE id = %s AND user_id = %s",
        (item_id, user["id"]),
        fetchone=True,
    )
    if not item:
        return api_error("Shopping item not found.", 404)
    execute("UPDATE shopping_items SET done = NOT done WHERE id = %s", (item_id,))
    row = execute("SELECT * FROM shopping_items WHERE id = %s", (item_id,), fetchone=True)
    return jsonify(serialize_shopping_item(row))


@app.delete("/api/shopping-items/<int:item_id>")
def delete_shopping_item(item_id):
    user, error = require_user()
    if error:
        return error
    item = execute(
        "SELECT * FROM shopping_items WHERE id = %s AND user_id = %s",
        (item_id, user["id"]),
        fetchone=True,
    )
    if not item:
        return api_error("Shopping item not found.", 404)
    execute("DELETE FROM shopping_items WHERE id = %s", (item_id,))
    return jsonify({"ok": True})


@app.get("/api/admin/database")
def admin_database():
    _user, error = require_admin()
    if error:
        return error
    users = execute("SELECT * FROM users ORDER BY id", fetchall=True)
    foods = execute("SELECT * FROM foods ORDER BY id", fetchall=True)
    shopping_items = execute("SELECT * FROM shopping_items ORDER BY id", fetchall=True)
    waste_logs = execute("SELECT * FROM waste_logs ORDER BY id", fetchall=True)
    activities = execute("SELECT * FROM activities ORDER BY id", fetchall=True)
    return jsonify({
        "users": [serialize_user(row) for row in users],
        "foods": [serialize_food(row) for row in foods],
        "shoppingItems": [serialize_shopping_item(row) for row in shopping_items],
        "wasteLogs": [serialize_waste_log(row) for row in waste_logs],
        "activities": [serialize_row(row) for row in activities],
    })


@app.delete("/api/admin/users/<int:user_id>")
def delete_user(user_id):
    user, error = require_admin()
    if error:
        return error
    if user_id == user["id"]:
        return api_error("This user cannot be deleted.")
    target = execute("SELECT * FROM users WHERE id = %s", (user_id,), fetchone=True)
    if not target or target["role"] == "admin":
        return api_error("This user cannot be deleted.")
    execute("DELETE FROM users WHERE id = %s", (user_id,))
    return jsonify({"ok": True})


if __name__ == "__main__":
    ensure_schema()
    app.run(host="127.0.0.1", port=5000, debug=True)
