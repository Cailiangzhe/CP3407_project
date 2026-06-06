const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  user: null,
  foods: [],
  shoppingItems: [],
  recipes: [],
  recipeIngredients: [],
  wasteLogs: [],
  adminSnapshot: null,
  currentView: "dashboard"
};

const views = {
  dashboard: { title: "Dashboard", eyebrow: "Overview", element: "#dashboardView" },
  pantry: { title: "Pantry Inventory", eyebrow: "Food records", element: "#pantryView" },
  shopping: { title: "Shopping List", eyebrow: "Planning", element: "#shoppingView" },
  recipes: { title: "Recipe Suggestions", eyebrow: "Use soon", element: "#recipesView" },
  admin: { title: "Database UI", eyebrow: "Administrator", element: "#adminView" }
};

const terminalStatuses = ["eaten", "expired", "discarded", "donated"];

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

const daysUntil = (dateString) => {
  const today = new Date(todayIso());
  const target = new Date(dateString);
  return Math.ceil((target - today) / 86400000);
};

const getRisk = (food) => {
  if (food.status !== "available") return "low";
  const days = daysUntil(food.expiryDate);
  if (days <= 2) return "high";
  if (days <= 5) return "medium";
  return "low";
};

const riskLabel = (food) => {
  const days = daysUntil(food.expiryDate);
  if (food.status !== "available") return food.status;
  if (days < 0) return `${Math.abs(days)} day(s) expired`;
  if (days === 0) return "expires today";
  return `${days} day(s) left`;
};

const isCurrentMonth = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

const getVisibleFoods = () => {
  const search = $("#searchFood")?.value.trim().toLowerCase() || "";
  const category = $("#categoryFilter")?.value || "all";
  const status = $("#statusFilter")?.value || "all";
  return state.foods.filter((food) => {
    const matchName = food.name.toLowerCase().includes(search);
    const matchCategory = category === "all" || food.category === category;
    const matchStatus = status === "all" || food.status === status;
    return matchName && matchCategory && matchStatus;
  });
};

const showToast = (message) => {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
};

const setAuthMode = (mode) => {
  const login = mode === "login";
  $("#loginTab").classList.toggle("active", login);
  $("#registerTab").classList.toggle("active", !login);
  $("#loginForm").hidden = !login;
  $("#registerForm").hidden = login;
};

const setView = async (viewName) => {
  state.currentView = viewName;
  $$(".view").forEach((view) => view.classList.remove("active"));
  $$(views[viewName].element).forEach((view) => view.classList.add("active"));
  $$(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  $("#viewTitle").textContent = views[viewName].title;
  $("#viewEyebrow").textContent = views[viewName].eyebrow;
  $("#openFoodModalBtn").hidden = viewName === "admin";
  if (viewName === "admin") {
    await loadAdminSnapshot();
  }
};

const refreshData = async () => {
  if (!state.user) return;
  const recipePayload = await FreshTrackApi.listRecipes();
  state.foods = await FreshTrackApi.listFoods(state.user);
  state.shoppingItems = await FreshTrackApi.listShoppingItems(state.user);
  state.wasteLogs = await FreshTrackApi.listWasteLogs(state.user);
  state.recipes = recipePayload.recipes;
  state.recipeIngredients = recipePayload.ingredients;
  renderAll();
};

const renderSession = () => {
  const loggedIn = Boolean(state.user);
  $("#authView").hidden = loggedIn;
  $("#appView").hidden = !loggedIn;
  $("#mainNav").hidden = !loggedIn;
  $("#sessionCard").hidden = !loggedIn;

  if (!loggedIn) return;

  $("#sessionName").textContent = state.user.name;
  $("#sessionRole").textContent = state.user.role === "admin" ? "Administrator" : state.user.email;
  $$(".admin-only").forEach((el) => {
    el.hidden = state.user.role !== "admin";
  });
};

const renderMetrics = () => {
  const availableFoods = state.foods.filter((food) => food.status === "available");
  const highRisk = availableFoods.filter((food) => getRisk(food) === "high");
  const monthlyWaste = state.wasteLogs.filter((log) => {
    return ["expired", "discarded"].includes(log.outcome) && isCurrentMonth(log.createdAt);
  });

  $("#metricTotal").textContent = availableFoods.length;
  $("#metricHighRisk").textContent = highRisk.length;
  $("#metricWaste").textContent = monthlyWaste.length;
  $("#metricLoss").textContent = formatMoney(monthlyWaste.reduce((sum, log) => sum + Number(log.price || 0), 0));
};

const renderRiskList = () => {
  const riskList = $("#riskList");
  const riskyFoods = state.foods
    .filter((food) => food.status === "available")
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))
    .slice(0, 8);

  if (!riskyFoods.length) {
    riskList.innerHTML = `<div class="risk-item">No pantry items yet.</div>`;
    return;
  }

  riskList.innerHTML = riskyFoods.map((food) => {
    const risk = getRisk(food);
    return `
      <div class="risk-item">
        <div>
          <strong>${escapeHtml(food.name)}</strong>
          <div class="hint">${escapeHtml(food.category)} - ${escapeHtml(food.location || "Pantry")} - ${riskLabel(food)}</div>
        </div>
        <span class="badge ${risk}">${risk}</span>
      </div>
    `;
  }).join("");
};

const renderActivityList = () => {
  const activityList = $("#activityList");
  const records = state.foods
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 6);

  if (!records.length) {
    activityList.innerHTML = `<div class="activity-item"><p>No activity yet.</p></div>`;
    return;
  }

  activityList.innerHTML = records.map((food) => `
    <div class="activity-item">
      <strong>${escapeHtml(food.name)}</strong>
      <p>Status: ${escapeHtml(food.status)} - Quantity: ${escapeHtml(food.quantity)} ${escapeHtml(food.unit || "item")}</p>
    </div>
  `).join("");
};

const matchFoodToIngredient = (food, ingredient) => {
  const foodName = food.name.toLowerCase();
  const ingredientName = ingredient.name.toLowerCase();
  return foodName === ingredientName || foodName.includes(ingredientName) || ingredientName.includes(foodName);
};

const matchRecipes = () => {
  const availableFoods = state.foods.filter((food) => food.status === "available");

  return state.recipes.map((recipe) => {
    const ingredients = state.recipeIngredients.filter((item) => item.recipeId === recipe.id);
    const ingredientMatches = ingredients.map((ingredient) => {
      const food = availableFoods.find((item) => matchFoodToIngredient(item, ingredient));
      return { ingredient, food };
    });
    const available = ingredientMatches.filter((entry) => entry.food);
    const urgent = available.filter((entry) => ["high", "medium"].includes(getRisk(entry.food)));
    const missing = ingredientMatches.filter((entry) => !entry.food).map((entry) => entry.ingredient);
    const score = ingredients.length ? available.length / ingredients.length : 0;

    return {
      ...recipe,
      ingredients,
      available,
      urgent,
      missing,
      score
    };
  }).sort((a, b) => {
    return b.urgent.length - a.urgent.length || b.score - a.score || a.prepMinutes - b.prepMinutes;
  });
};

const renderExpiryMenu = () => {
  const menu = $("#expiryMenu");
  const nearExpiry = state.foods
    .filter((food) => food.status === "available")
    .filter((food) => daysUntil(food.expiryDate) <= 5)
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))
    .slice(0, 5);

  if (!nearExpiry.length) {
    menu.innerHTML = `
      <div class="menu-card calm">
        <strong>No urgent food today</strong>
        <p>Your available pantry items are currently low risk.</p>
      </div>
    `;
    return;
  }

  const recipeMatches = matchRecipes();
  menu.innerHTML = nearExpiry.map((food) => {
    const bestRecipe = recipeMatches.find((recipe) => {
      return recipe.available.some((entry) => entry.food.id === food.id);
    });
    return `
      <article class="menu-card">
        <div>
          <span class="badge ${getRisk(food)}">${getRisk(food)}</span>
          <h4>${escapeHtml(food.name)}</h4>
          <p>${riskLabel(food)} - ${escapeHtml(food.quantity)} ${escapeHtml(food.unit || "item")} in ${escapeHtml(food.location || "Pantry")}</p>
        </div>
        <div class="menu-action">
          <strong>${bestRecipe ? escapeHtml(bestRecipe.title) : "Use in today's meal"}</strong>
          <span>${bestRecipe ? `${Math.round(bestRecipe.score * 100)}% ingredient match` : "No matching recipe yet"}</span>
        </div>
      </article>
    `;
  }).join("");
};

const renderWasteInsights = () => {
  const container = $("#wasteInsights");
  const monthlyLogs = state.wasteLogs.filter((log) => isCurrentMonth(log.createdAt));
  const wasteLogs = monthlyLogs.filter((log) => ["expired", "discarded"].includes(log.outcome));
  const savedLogs = monthlyLogs.filter((log) => ["eaten", "donated"].includes(log.outcome));

  if (!monthlyLogs.length) {
    container.innerHTML = `
      <div class="insight-card">
        <strong>No outcomes recorded yet</strong>
        <p>Change an item's status to eaten, expired, discarded, or donated to build analytics.</p>
      </div>
    `;
    return;
  }

  const total = Math.max(monthlyLogs.length, 1);
  const savedPercent = Math.round((savedLogs.length / total) * 100);
  const wastePercent = Math.round((wasteLogs.length / total) * 100);
  const wasteCost = wasteLogs.reduce((sum, log) => sum + Number(log.price || 0), 0);

  container.innerHTML = `
    <div class="insight-card">
      <div class="insight-row"><span>Food saved</span><strong>${savedLogs.length}</strong></div>
      <div class="progress"><span style="width: ${savedPercent}%"></span></div>
    </div>
    <div class="insight-card">
      <div class="insight-row"><span>Food wasted</span><strong>${wasteLogs.length}</strong></div>
      <div class="progress danger"><span style="width: ${wastePercent}%"></span></div>
    </div>
    <div class="insight-card">
      <div class="insight-row"><span>Estimated loss</span><strong>${formatMoney(wasteCost)}</strong></div>
      <p>Only expired and discarded items count as waste loss.</p>
    </div>
  `;
};

const renderFoodTable = () => {
  const body = $("#foodTableBody");
  const foods = getVisibleFoods();
  if (!foods.length) {
    body.innerHTML = `<tr><td colspan="9">No food records found.</td></tr>`;
    return;
  }

  body.innerHTML = foods.map((food) => {
    const risk = getRisk(food);
    return `
      <tr>
        <td><strong>${escapeHtml(food.name)}</strong></td>
        <td>${escapeHtml(food.category)}</td>
        <td>${escapeHtml(food.quantity)} ${escapeHtml(food.unit || "item")}</td>
        <td>${escapeHtml(food.location || "Pantry")}</td>
        <td>${escapeHtml(food.purchaseDate)}</td>
        <td>${escapeHtml(food.expiryDate)}</td>
        <td><span class="badge ${risk}">${risk}</span></td>
        <td>
          <select data-action="status" data-id="${escapeHtml(food.id)}" aria-label="Update status for ${escapeHtml(food.name)}">
            ${["available", "eaten", "expired", "discarded", "donated"].map((status) => {
              return `<option value="${status}" ${food.status === status ? "selected" : ""}>${status}</option>`;
            }).join("")}
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit" data-id="${escapeHtml(food.id)}">Edit</button>
            <button class="danger" type="button" data-action="delete" data-id="${escapeHtml(food.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
};

const renderShoppingList = () => {
  const list = $("#shoppingList");
  if (!state.shoppingItems.length) {
    list.innerHTML = `<li class="check-item">No shopping items yet.</li>`;
    return;
  }

  list.innerHTML = state.shoppingItems.map((item) => `
    <li class="check-item ${item.done ? "done" : ""}">
      <label>
        <input type="checkbox" data-action="toggle-shopping" data-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""}>
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.quantity || 1)} - ${escapeHtml(item.category || "Other")} - ${escapeHtml(item.source || "manual")}</small>
        </span>
      </label>
      <button class="ghost-button" type="button" data-action="delete-shopping" data-id="${escapeHtml(item.id)}">Delete</button>
    </li>
  `).join("");
};

const renderRecipes = () => {
  const recipes = matchRecipes();
  const grid = $("#recipeGrid");
  if (!recipes.length) {
    grid.innerHTML = `<div class="recipe-card"><h4>No recipes yet</h4><p>Add local recipe data to generate suggestions.</p></div>`;
    return;
  }

  grid.innerHTML = recipes.map((recipe) => {
    const matchPercent = Math.round(recipe.score * 100);
    const urgentNames = recipe.urgent.map((entry) => entry.food.name).join(", ");
    const availableNames = recipe.available.map((entry) => entry.ingredient.name).join(", ") || "None yet";
    const missingNames = recipe.missing.map((ingredient) => ingredient.name).join(", ") || "Nothing missing";
    return `
      <article class="recipe-card">
        <div class="recipe-topline">
          <span class="badge ${recipe.urgent.length ? "high" : recipe.score >= 0.5 ? "medium" : "low"}">${matchPercent}% match</span>
          <span>${escapeHtml(recipe.prepMinutes)} min</span>
        </div>
        <h4>${escapeHtml(recipe.title)}</h4>
        <p>${escapeHtml(recipe.description)}</p>
        <p><strong>Available:</strong> ${escapeHtml(availableNames)}</p>
        <p><strong>Missing:</strong> ${escapeHtml(missingNames)}</p>
        ${urgentNames ? `<p class="use-soon"><strong>Use soon:</strong> ${escapeHtml(urgentNames)}</p>` : ""}
        <button class="ghost-button" type="button" data-action="add-missing" data-recipe-id="${escapeHtml(recipe.id)}">
          Add missing to shopping list
        </button>
      </article>
    `;
  }).join("");
};

const renderAdmin = () => {
  if (!state.adminSnapshot) return;

  const { users, foods, wasteLogs = [] } = state.adminSnapshot;
  $("#adminUserCount").textContent = users.length;
  $("#adminFoodCount").textContent = foods.length;
  $("#adminWasteCount").textContent = wasteLogs.filter((log) => {
    return ["expired", "discarded"].includes(log.outcome);
  }).length;

  $("#adminUsersBody").innerHTML = users.map((user) => {
    const count = foods.filter((food) => food.userId === user.id).length;
    const canDelete = user.id !== state.user.id && user.role !== "admin";
    return `
      <tr>
        <td>${escapeHtml(user.id)}</td>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${count}</td>
        <td>
          ${canDelete ? `<button class="ghost-button" data-action="delete-user" data-id="${escapeHtml(user.id)}" type="button">Delete</button>` : "Protected"}
        </td>
      </tr>
    `;
  }).join("");

  $("#adminFoodsBody").innerHTML = foods.length ? foods.map((food) => {
    const owner = users.find((user) => user.id === food.userId);
    return `
      <tr>
        <td>${escapeHtml(food.id)}</td>
        <td>${owner ? escapeHtml(owner.email) : "Unknown"}</td>
        <td>${escapeHtml(food.name)}</td>
        <td>${escapeHtml(food.category)}</td>
        <td>${escapeHtml(food.quantity)} ${escapeHtml(food.unit || "item")}</td>
        <td>${escapeHtml(food.expiryDate)}</td>
        <td>${escapeHtml(food.status)}</td>
        <td><button class="ghost-button" data-action="admin-delete-food" data-id="${escapeHtml(food.id)}" type="button">Delete</button></td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="8">No food records.</td></tr>`;
};

const renderAll = () => {
  renderSession();
  if (!state.user) return;
  renderMetrics();
  renderExpiryMenu();
  renderWasteInsights();
  renderRiskList();
  renderActivityList();
  renderFoodTable();
  renderShoppingList();
  renderRecipes();
  renderAdmin();
};

const loadAdminSnapshot = async () => {
  if (state.user?.role !== "admin") return;
  state.adminSnapshot = await FreshTrackApi.getAdminSnapshot(state.user);
  renderAdmin();
};

const openFoodModal = (food = null) => {
  const form = $("#foodForm");
  form.reset();
  $("#foodModalTitle").textContent = food ? "Edit Food" : "Add Food";
  form.elements.id.value = food?.id || "";
  form.elements.name.value = food?.name || "";
  form.elements.category.value = food?.category || "Vegetables";
  form.elements.quantity.value = food?.quantity || 1;
  form.elements.unit.value = food?.unit || "item";
  form.elements.location.value = food?.location || "Pantry";
  form.elements.purchaseDate.value = food?.purchaseDate || todayIso();
  form.elements.expiryDate.value = food?.expiryDate || todayIso();
  form.elements.price.value = food?.price || 0;
  $("#foodModal").showModal();
};

const closeFoodModal = () => {
  $("#foodModal").close();
};

const addSuggestedShoppingItems = async () => {
  const existing = new Set(state.shoppingItems.map((item) => item.name.toLowerCase()));
  const lowStock = state.foods
    .filter((food) => food.status !== "available" || Number(food.quantity) <= 1)
    .map((food) => ({ name: food.name, category: food.category, source: "low stock" }));
  const topRecipeMissing = matchRecipes()[0]?.missing.map((ingredient) => ({
    name: ingredient.name,
    category: ingredient.category,
    source: "recipe"
  })) || [];
  const suggestions = [...lowStock, ...topRecipeMissing]
    .filter((item) => !existing.has(item.name.toLowerCase()))
    .slice(0, 6);

  if (!suggestions.length) {
    showToast("No shopping suggestions right now.");
    return;
  }

  for (const item of suggestions) {
    await FreshTrackApi.createShoppingItem(state.user, item);
  }
  await refreshData();
  showToast("Shopping suggestions added.");
};

const addRecipeMissingToShopping = async (recipeId) => {
  const recipe = matchRecipes().find((item) => item.id === recipeId);
  if (!recipe) return;

  const existing = new Set(state.shoppingItems.map((item) => item.name.toLowerCase()));
  const missing = recipe.missing.filter((ingredient) => !existing.has(ingredient.name.toLowerCase()));

  if (!missing.length) {
    showToast("All missing ingredients are already in the shopping list.");
    return;
  }

  for (const ingredient of missing) {
    await FreshTrackApi.createShoppingItem(state.user, {
      name: ingredient.name,
      category: ingredient.category,
      source: recipe.title
    });
  }

  await refreshData();
  showToast("Missing ingredients added.");
};

const bindEvents = () => {
  $("#loginTab").addEventListener("click", () => setAuthMode("login"));
  $("#registerTab").addEventListener("click", () => setAuthMode("register"));

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      state.user = await FreshTrackApi.login(Object.fromEntries(form.entries()));
      await refreshData();
      await setView("dashboard");
      showToast("Logged in successfully.");
    } catch (error) {
      showToast(error.message);
    }
  });

  $("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      state.user = await FreshTrackApi.register(Object.fromEntries(form.entries()));
      await refreshData();
      await setView("dashboard");
      showToast("Account created.");
    } catch (error) {
      showToast(error.message);
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await FreshTrackApi.logout();
    state.user = null;
    state.foods = [];
    state.shoppingItems = [];
    state.wasteLogs = [];
    state.adminSnapshot = null;
    renderAll();
    setAuthMode("login");
  });

  $("#mainNav").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    await setView(button.dataset.view);
  });

  $("#openFoodModalBtn").addEventListener("click", () => openFoodModal());
  $("#closeFoodModalBtn").addEventListener("click", closeFoodModal);

  $("#foodForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const id = data.id;
    delete data.id;
    try {
      if (id) {
        await FreshTrackApi.updateFood(state.user, id, data);
        showToast("Food updated.");
      } else {
        await FreshTrackApi.createFood(state.user, data);
        showToast("Food added.");
      }
      closeFoodModal();
      await refreshData();
      if (state.currentView === "admin") await loadAdminSnapshot();
    } catch (error) {
      showToast(error.message);
    }
  });

  $("#foodTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const food = state.foods.find((item) => item.id === button.dataset.id);
    if (!food) return;
    if (button.dataset.action === "edit") openFoodModal(food);
    if (button.dataset.action === "delete") {
      await FreshTrackApi.deleteFood(state.user, food.id);
      await refreshData();
      showToast("Food deleted.");
    }
  });

  $("#foodTableBody").addEventListener("change", async (event) => {
    if (event.target.dataset.action !== "status") return;
    await FreshTrackApi.updateFood(state.user, event.target.dataset.id, {
      status: event.target.value
    });
    await refreshData();
    showToast(terminalStatuses.includes(event.target.value) ? "Outcome recorded." : "Status updated.");
  });

  $("#searchFood").addEventListener("input", renderFoodTable);
  $("#categoryFilter").addEventListener("change", renderFoodTable);
  $("#statusFilter").addEventListener("change", renderFoodTable);

  $("#shoppingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("item");
    await FreshTrackApi.createShoppingItem(state.user, name);
    event.currentTarget.reset();
    await refreshData();
  });

  $("#shoppingList").addEventListener("change", async (event) => {
    if (event.target.dataset.action !== "toggle-shopping") return;
    await FreshTrackApi.toggleShoppingItem(state.user, event.target.dataset.id);
    await refreshData();
  });

  $("#shoppingList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action='delete-shopping']");
    if (!button) return;
    await FreshTrackApi.deleteShoppingItem(state.user, button.dataset.id);
    await refreshData();
  });

  $("#suggestShoppingBtn").addEventListener("click", addSuggestedShoppingItems);

  $("#recipeGrid").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action='add-missing']");
    if (!button) return;
    await addRecipeMissingToShopping(button.dataset.recipeId);
  });

  $("#adminView").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "delete-user") {
      await FreshTrackApi.deleteUser(state.user, button.dataset.id);
      await loadAdminSnapshot();
      showToast("User and related records deleted.");
    }
    if (button.dataset.action === "admin-delete-food") {
      await FreshTrackApi.deleteFood(state.user, button.dataset.id);
      await refreshData();
      await loadAdminSnapshot();
      showToast("Food record deleted.");
    }
  });
};

const boot = async () => {
  bindEvents();
  state.user = await FreshTrackApi.getSession();
  renderSession();
  if (state.user) {
    await refreshData();
    await setView("dashboard");
  }
};

boot();
