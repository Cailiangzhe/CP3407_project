window.FreshTrackApi = (() => {
  const USE_REMOTE_API = true;
  const API_BASE_URL = window.location.protocol === "file:"
    ? "http://localhost:5000/api"
    : `${window.location.origin}/api`;
  const STORAGE_KEY = "freshtrack_h5_database_v2";
  const LEGACY_STORAGE_KEY = "freshtrack_h5_database_v1";
  const SESSION_KEY = "freshtrack_h5_session_v1";

  const nowIso = () => new Date().toISOString();

  const createId = (prefix) => {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const defaultRecipes = () => ([
    {
      id: "r_veg_omelette",
      title: "Use-Soon Vegetable Omelette",
      description: "A fast breakfast or dinner that uses soft vegetables before they expire.",
      prepMinutes: 15,
      difficulty: "Easy"
    },
    {
      id: "r_fried_rice",
      title: "Leftover Fried Rice",
      description: "A flexible meal for grains, eggs, vegetables, and small leftovers.",
      prepMinutes: 20,
      difficulty: "Easy"
    },
    {
      id: "r_pantry_soup",
      title: "Pantry Rescue Soup",
      description: "A simple soup for mixed produce, meat, grains, or dairy close to expiry.",
      prepMinutes: 30,
      difficulty: "Easy"
    },
    {
      id: "r_yogurt_bowl",
      title: "Fruit Yogurt Bowl",
      description: "A no-cook option for fruit and dairy that should be used soon.",
      prepMinutes: 8,
      difficulty: "Easy"
    },
    {
      id: "r_wrap",
      title: "Quick Pantry Wrap",
      description: "A light lunch using vegetables, dairy, grains, or leftover protein.",
      prepMinutes: 12,
      difficulty: "Easy"
    }
  ]);

  const defaultRecipeIngredients = () => ([
    { id: "ri_1", recipeId: "r_veg_omelette", name: "Eggs", category: "Dairy" },
    { id: "ri_2", recipeId: "r_veg_omelette", name: "Tomato", category: "Vegetables" },
    { id: "ri_3", recipeId: "r_veg_omelette", name: "Spinach", category: "Vegetables" },
    { id: "ri_4", recipeId: "r_veg_omelette", name: "Cheese", category: "Dairy" },
    { id: "ri_5", recipeId: "r_fried_rice", name: "Rice", category: "Grains" },
    { id: "ri_6", recipeId: "r_fried_rice", name: "Carrot", category: "Vegetables" },
    { id: "ri_7", recipeId: "r_fried_rice", name: "Eggs", category: "Dairy" },
    { id: "ri_8", recipeId: "r_fried_rice", name: "Chicken", category: "Meat" },
    { id: "ri_9", recipeId: "r_pantry_soup", name: "Potato", category: "Vegetables" },
    { id: "ri_10", recipeId: "r_pantry_soup", name: "Carrot", category: "Vegetables" },
    { id: "ri_11", recipeId: "r_pantry_soup", name: "Chicken", category: "Meat" },
    { id: "ri_12", recipeId: "r_pantry_soup", name: "Milk", category: "Dairy" },
    { id: "ri_13", recipeId: "r_yogurt_bowl", name: "Yogurt", category: "Dairy" },
    { id: "ri_14", recipeId: "r_yogurt_bowl", name: "Banana", category: "Fruits" },
    { id: "ri_15", recipeId: "r_yogurt_bowl", name: "Apple", category: "Fruits" },
    { id: "ri_16", recipeId: "r_wrap", name: "Tortilla", category: "Grains" },
    { id: "ri_17", recipeId: "r_wrap", name: "Lettuce", category: "Vegetables" },
    { id: "ri_18", recipeId: "r_wrap", name: "Cheese", category: "Dairy" },
    { id: "ri_19", recipeId: "r_wrap", name: "Chicken", category: "Meat" }
  ]);

  const defaultDatabase = () => {
    const createdAt = nowIso();
    return {
      users: [
        {
          id: "u_admin",
          name: "FreshTrack Admin",
          email: "admin@freshtrack.local",
          password: "Admin123!",
          role: "admin",
          createdAt
        },
        {
          id: "u_demo",
          name: "Mia Household",
          email: "mia@example.com",
          password: "Demo123!",
          role: "user",
          createdAt
        },
        {
          id: "u_demo2",
          name: "Ben Household",
          email: "ben@example.com",
          password: "Demo123!",
          role: "user",
          createdAt
        }
      ],
      foods: [
        {
          id: "f_demo_1",
          userId: "u_demo",
          name: "Spinach",
          category: "Vegetables",
          quantity: 1,
          unit: "bag",
          location: "Fridge",
          purchaseDate: offsetDate(-3),
          expiryDate: offsetDate(1),
          price: 3.2,
          status: "available",
          createdAt,
          updatedAt: createdAt
        },
        {
          id: "f_demo_2",
          userId: "u_demo",
          name: "Yogurt",
          category: "Dairy",
          quantity: 2,
          unit: "cups",
          location: "Fridge",
          purchaseDate: offsetDate(-5),
          expiryDate: offsetDate(3),
          price: 4.5,
          status: "available",
          createdAt,
          updatedAt: createdAt
        },
        {
          id: "f_demo_3",
          userId: "u_demo",
          name: "Rice",
          category: "Grains",
          quantity: 1,
          unit: "pack",
          location: "Pantry",
          purchaseDate: offsetDate(-10),
          expiryDate: offsetDate(40),
          price: 6.9,
          status: "available",
          createdAt,
          updatedAt: createdAt
        },
        {
          id: "f_demo_4",
          userId: "u_demo2",
          name: "Chicken",
          category: "Meat",
          quantity: 1,
          unit: "pack",
          location: "Freezer",
          purchaseDate: offsetDate(-2),
          expiryDate: offsetDate(5),
          price: 8.8,
          status: "available",
          createdAt,
          updatedAt: createdAt
        }
      ],
      recipes: defaultRecipes(),
      recipeIngredients: defaultRecipeIngredients(),
      shoppingItems: [],
      wasteLogs: [],
      activities: [
        {
          id: "a_seed",
          userId: "u_demo",
          type: "system",
          message: "Demo pantry data was prepared for Mia Household.",
          createdAt
        }
      ]
    };
  };

  function offsetDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  const normalizeDatabase = (db) => {
    const seeded = defaultDatabase();
    const normalized = {
      users: db.users || [],
      foods: db.foods || [],
      recipes: db.recipes?.length ? db.recipes : defaultRecipes(),
      recipeIngredients: db.recipeIngredients?.length ? db.recipeIngredients : defaultRecipeIngredients(),
      shoppingItems: db.shoppingItems || [],
      wasteLogs: db.wasteLogs || [],
      activities: db.activities || []
    };

    for (const seedUser of seeded.users) {
      if (!normalized.users.some((user) => user.email === seedUser.email)) {
        normalized.users.push(seedUser);
      }
    }

    for (const seedFood of seeded.foods) {
      if (!normalized.foods.some((food) => food.id === seedFood.id)) {
        normalized.foods.push(seedFood);
      }
    }

    normalized.foods = normalized.foods.map((food) => ({
      unit: "item",
      location: "Pantry",
      ...food,
      quantity: Number(food.quantity || 1),
      price: Number(food.price || 0)
    }));

    normalized.shoppingItems = normalized.shoppingItems.map((item) => ({
      category: "Other",
      quantity: 1,
      source: "manual",
      ...item
    }));

    return normalized;
  };

  const loadDatabase = () => {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      const db = defaultDatabase();
      saveDatabase(db);
      return db;
    }
    const db = normalizeDatabase(JSON.parse(raw));
    saveDatabase(db);
    return db;
  };

  const saveDatabase = (db) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  };

  const sanitizeUser = (user) => {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  };

  const addActivity = (db, userId, type, message) => {
    db.activities.push({
      id: createId("a"),
      userId,
      type,
      message,
      createdAt: nowIso()
    });
  };

  const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      credentials: "include",
      ...options
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Request failed");
    }
    return response.json();
  };

  const localApi = {
    async register({ name, email, password }) {
      const db = loadDatabase();
      const normalizedEmail = email.trim().toLowerCase();
      if (db.users.some((user) => user.email === normalizedEmail)) {
        throw new Error("This email is already registered.");
      }
      const user = {
        id: createId("u"),
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: "user",
        createdAt: nowIso()
      };
      db.users.push(user);
      addActivity(db, user.id, "account", `${user.name} registered an account.`);
      saveDatabase(db);
      localStorage.setItem(SESSION_KEY, user.id);
      return sanitizeUser(user);
    },

    async login({ email, password }) {
      const db = loadDatabase();
      const user = db.users.find((item) => {
        return item.email === email.trim().toLowerCase() && item.password === password;
      });
      if (!user) {
        throw new Error("Invalid email or password.");
      }
      localStorage.setItem(SESSION_KEY, user.id);
      return sanitizeUser(user);
    },

    async logout() {
      localStorage.removeItem(SESSION_KEY);
      return true;
    },

    async getSession() {
      const db = loadDatabase();
      return sanitizeUser(db.users.find((user) => user.id === localStorage.getItem(SESSION_KEY)));
    },

    async listFoods(user) {
      const db = loadDatabase();
      if (user.role === "admin") return db.foods;
      return db.foods.filter((food) => food.userId === user.id);
    },

    async createFood(user, foodInput) {
      const db = loadDatabase();
      const food = {
        id: createId("f"),
        userId: user.id,
        status: "available",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...foodInput,
        quantity: Number(foodInput.quantity),
        price: Number(foodInput.price || 0),
        unit: foodInput.unit || "item",
        location: foodInput.location || "Pantry"
      };
      db.foods.push(food);
      addActivity(db, user.id, "food", `${food.name} was added to pantry.`);
      saveDatabase(db);
      return food;
    },

    async updateFood(user, id, patch) {
      const db = loadDatabase();
      const food = db.foods.find((item) => item.id === id);
      if (!food || (user.role !== "admin" && food.userId !== user.id)) {
        throw new Error("Food record not found.");
      }

      const oldStatus = food.status;
      Object.assign(food, patch, {
        quantity: Number(patch.quantity ?? food.quantity),
        price: Number(patch.price ?? food.price),
        unit: patch.unit ?? food.unit ?? "item",
        location: patch.location ?? food.location ?? "Pantry",
        updatedAt: nowIso()
      });

      const terminalStatuses = ["eaten", "expired", "discarded", "donated"];
      if (patch.status && patch.status !== oldStatus && terminalStatuses.includes(patch.status)) {
        db.wasteLogs.push({
          id: createId("w"),
          userId: food.userId,
          foodId: food.id,
          foodName: food.name,
          category: food.category,
          quantity: food.quantity,
          unit: food.unit || "item",
          price: Number(food.price || 0),
          outcome: patch.status,
          createdAt: nowIso()
        });
      }

      addActivity(db, food.userId, "food", `${food.name} was updated.`);
      saveDatabase(db);
      return food;
    },

    async deleteFood(user, id) {
      const db = loadDatabase();
      const index = db.foods.findIndex((food) => food.id === id);
      if (index < 0 || (user.role !== "admin" && db.foods[index].userId !== user.id)) {
        throw new Error("Food record not found.");
      }
      const [removed] = db.foods.splice(index, 1);
      addActivity(db, removed.userId, "food", `${removed.name} was deleted.`);
      saveDatabase(db);
      return removed;
    },

    async listRecipes() {
      const db = loadDatabase();
      return {
        recipes: db.recipes,
        ingredients: db.recipeIngredients
      };
    },

    async listWasteLogs(user) {
      const db = loadDatabase();
      if (user.role === "admin") return db.wasteLogs;
      return db.wasteLogs.filter((log) => log.userId === user.id);
    },

    async listShoppingItems(user) {
      const db = loadDatabase();
      return db.shoppingItems.filter((item) => item.userId === user.id);
    },

    async createShoppingItem(user, input) {
      const db = loadDatabase();
      const payload = typeof input === "string" ? { name: input } : input;
      const item = {
        id: createId("s"),
        userId: user.id,
        name: payload.name.trim(),
        category: payload.category || "Other",
        quantity: Number(payload.quantity || 1),
        source: payload.source || "manual",
        done: false,
        createdAt: nowIso()
      };
      db.shoppingItems.push(item);
      saveDatabase(db);
      return item;
    },

    async toggleShoppingItem(user, id) {
      const db = loadDatabase();
      const item = db.shoppingItems.find((entry) => entry.id === id && entry.userId === user.id);
      if (!item) throw new Error("Shopping item not found.");
      item.done = !item.done;
      saveDatabase(db);
      return item;
    },

    async deleteShoppingItem(user, id) {
      const db = loadDatabase();
      db.shoppingItems = db.shoppingItems.filter((item) => {
        return !(item.id === id && item.userId === user.id);
      });
      saveDatabase(db);
      return true;
    },

    async getAdminSnapshot(user) {
      if (user.role !== "admin") {
        throw new Error("Admin permission is required.");
      }
      const db = loadDatabase();
      return {
        users: db.users.map(sanitizeUser),
        foods: db.foods,
        shoppingItems: db.shoppingItems,
        wasteLogs: db.wasteLogs,
        activities: db.activities
      };
    },

    async deleteUser(user, id) {
      if (user.role !== "admin" || id === user.id) {
        throw new Error("This user cannot be deleted.");
      }
      const db = loadDatabase();
      db.users = db.users.filter((item) => item.id !== id);
      db.foods = db.foods.filter((food) => food.userId !== id);
      db.shoppingItems = db.shoppingItems.filter((item) => item.userId !== id);
      db.wasteLogs = db.wasteLogs.filter((log) => log.userId !== id);
      db.activities = db.activities.filter((activity) => activity.userId !== id);
      saveDatabase(db);
      return true;
    }
  };

  const remoteApi = {
    register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    logout: () => request("/auth/logout", { method: "POST" }),
    getSession: () => request("/auth/me"),
    listFoods: () => request("/foods"),
    createFood: (_user, payload) => request("/foods", { method: "POST", body: JSON.stringify(payload) }),
    updateFood: (_user, id, payload) => request(`/foods/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteFood: (_user, id) => request(`/foods/${id}`, { method: "DELETE" }),
    listRecipes: () => request("/recipes"),
    listWasteLogs: () => request("/waste-logs"),
    listShoppingItems: () => request("/shopping-items"),
    createShoppingItem: (_user, payload) => request("/shopping-items", {
      method: "POST",
      body: JSON.stringify(typeof payload === "string" ? { name: payload } : payload)
    }),
    toggleShoppingItem: (_user, id) => request(`/shopping-items/${id}/toggle`, { method: "PATCH" }),
    deleteShoppingItem: (_user, id) => request(`/shopping-items/${id}`, { method: "DELETE" }),
    getAdminSnapshot: () => request("/admin/database"),
    deleteUser: (_user, id) => request(`/admin/users/${id}`, { method: "DELETE" })
  };

  return USE_REMOTE_API ? remoteApi : localApi;
})();
