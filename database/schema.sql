CREATE DATABASE IF NOT EXISTS freshtrack
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE freshtrack;

-- FreshTrack uses one shared application database.
-- User data is kept private by storing ownership through user_id foreign keys.
-- In the backend, every normal-user query must filter by the authenticated user_id.

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
);

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
  CONSTRAINT fk_foods_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipe_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  category ENUM('Vegetables', 'Fruits', 'Meat', 'Dairy', 'Grains', 'Other') NOT NULL DEFAULT 'Other',
  PRIMARY KEY (id),
  KEY idx_recipe_ingredients_recipe_id (recipe_id),
  UNIQUE KEY uq_recipe_ingredient_name (recipe_id, name),
  CONSTRAINT fk_recipe_ingredients_recipe
    FOREIGN KEY (recipe_id) REFERENCES recipes (id)
    ON DELETE CASCADE
);

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
  CONSTRAINT fk_shopping_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

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
  CONSTRAINT fk_waste_logs_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_waste_logs_food
    FOREIGN KEY (food_id) REFERENCES foods (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(40) NOT NULL,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activities_user_id (user_id),
  CONSTRAINT fk_activities_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

INSERT INTO users (name, email, password_hash, role)
VALUES (
  'FreshTrack Admin',
  'admin@freshtrack.local',
  '$2b$12$replace_with_real_bcrypt_hash_for_Admin123',
  'admin'
)
ON DUPLICATE KEY UPDATE role = 'admin';

INSERT INTO recipes (title, description, prep_minutes, difficulty) VALUES
  ('Use-Soon Vegetable Omelette', 'A fast meal that uses vegetables and dairy close to expiry.', 15, 'Easy'),
  ('Leftover Fried Rice', 'A flexible recipe for grains, vegetables, eggs, and leftover protein.', 20, 'Easy'),
  ('Pantry Rescue Soup', 'A simple soup for mixed produce, grains, dairy, or meat close to expiry.', 30, 'Easy'),
  ('Fruit Yogurt Bowl', 'A no-cook option for fruit and dairy that should be used soon.', 8, 'Easy'),
  ('Quick Pantry Wrap', 'A light lunch using vegetables, dairy, grains, or leftover protein.', 12, 'Easy')
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO recipe_ingredients (recipe_id, name, category)
SELECT id, 'Eggs', 'Dairy' FROM recipes WHERE title = 'Use-Soon Vegetable Omelette'
UNION ALL SELECT id, 'Tomato', 'Vegetables' FROM recipes WHERE title = 'Use-Soon Vegetable Omelette'
UNION ALL SELECT id, 'Spinach', 'Vegetables' FROM recipes WHERE title = 'Use-Soon Vegetable Omelette'
UNION ALL SELECT id, 'Cheese', 'Dairy' FROM recipes WHERE title = 'Use-Soon Vegetable Omelette'
UNION ALL SELECT id, 'Rice', 'Grains' FROM recipes WHERE title = 'Leftover Fried Rice'
UNION ALL SELECT id, 'Carrot', 'Vegetables' FROM recipes WHERE title = 'Leftover Fried Rice'
UNION ALL SELECT id, 'Eggs', 'Dairy' FROM recipes WHERE title = 'Leftover Fried Rice'
UNION ALL SELECT id, 'Chicken', 'Meat' FROM recipes WHERE title = 'Leftover Fried Rice'
UNION ALL SELECT id, 'Potato', 'Vegetables' FROM recipes WHERE title = 'Pantry Rescue Soup'
UNION ALL SELECT id, 'Carrot', 'Vegetables' FROM recipes WHERE title = 'Pantry Rescue Soup'
UNION ALL SELECT id, 'Chicken', 'Meat' FROM recipes WHERE title = 'Pantry Rescue Soup'
UNION ALL SELECT id, 'Milk', 'Dairy' FROM recipes WHERE title = 'Pantry Rescue Soup'
UNION ALL SELECT id, 'Yogurt', 'Dairy' FROM recipes WHERE title = 'Fruit Yogurt Bowl'
UNION ALL SELECT id, 'Banana', 'Fruits' FROM recipes WHERE title = 'Fruit Yogurt Bowl'
UNION ALL SELECT id, 'Apple', 'Fruits' FROM recipes WHERE title = 'Fruit Yogurt Bowl'
UNION ALL SELECT id, 'Tortilla', 'Grains' FROM recipes WHERE title = 'Quick Pantry Wrap'
UNION ALL SELECT id, 'Lettuce', 'Vegetables' FROM recipes WHERE title = 'Quick Pantry Wrap'
UNION ALL SELECT id, 'Cheese', 'Dairy' FROM recipes WHERE title = 'Quick Pantry Wrap'
UNION ALL SELECT id, 'Chicken', 'Meat' FROM recipes WHERE title = 'Quick Pantry Wrap'
ON DUPLICATE KEY UPDATE category = VALUES(category);
