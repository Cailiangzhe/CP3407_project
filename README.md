# FreshTrack H5 Frontend

This folder contains an improved H5 prototype for the CP3407 FreshTrack app. It is still self-contained and does not call external APIs, but it now demonstrates account-based data isolation, use-soon meal planning, recipe matching, shopping suggestions, and waste analytics.

## Team and Planning

- Group: PA9
- Initial user stories: [BACKLOG.md](BACKLOG.md)
- Project plan: [PLAN.md](PLAN.md)

## Files

- `index.html` - single page H5 application.
- `assets/css/styles.css` - responsive green/white UI styling.
- `assets/js/app.js` - page interaction, account isolation, pantry logic, use-soon menu, dashboard, shopping list, recipe suggestions, waste analytics, and admin database UI.
- `assets/js/api.js` - backend-ready data interface. It currently uses `localStorage`; switch `USE_REMOTE_API` to `true` when a Flask/MySQL API is available.
- `database/schema.sql` - MySQL schema for users, foods, recipes, recipe ingredients, shopping items, waste logs, and activity records.

## Demo Login

- Admin email: `admin@freshtrack.local`
- Admin password: `Admin123!`
- Demo user email: `mia@example.com`
- Demo user password: `Demo123!`

Normal users can register from the Register tab. Each user only sees their own food, shopping, and waste records. The admin account can open `Database UI` to view all users and food records.

## Data Separation Design

FreshTrack does not need one physical database per user. A more realistic design is one shared application database where every user-owned table stores a `user_id` foreign key. After login, the backend uses the authenticated user's `user_id` to filter pantry, shopping, and waste-log records. This gives every account a private pantry while keeping the database maintainable.

## Run with MySQL

The browser should not connect to MySQL directly. Run the Flask backend, then open the app through Flask:

```powershell
cd freshtrack-h5-optimized
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

$env:FRESHTRACK_DB_HOST="127.0.0.1"
$env:FRESHTRACK_DB_PORT="3306"
$env:FRESHTRACK_DB_USER="root"
$env:FRESHTRACK_DB_PASSWORD="your_mysql_password"
$env:FRESHTRACK_DB_NAME="freshtrack"
$env:FRESHTRACK_SECRET_KEY="change-this-before-submission"

.\.venv\Scripts\python.exe backend\app.py
```

Then open:

```text
http://localhost:5000
```

On startup, the backend creates the `freshtrack` database and required tables if they do not already exist. It also seeds the admin account, demo users, demo pantry records, and local recipe data.

If your MySQL root account does not allow creating databases, create the database manually first, then use a MySQL user that has permissions on `freshtrack`.

## Backend API Contract

The frontend calls through `FreshTrackApi`. The Flask backend implements these endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/foods`
- `POST /api/foods`
- `PUT /api/foods/:id`
- `DELETE /api/foods/:id`
- `GET /api/recipes`
- `GET /api/waste-logs`
- `GET /api/shopping-items`
- `POST /api/shopping-items`
- `PATCH /api/shopping-items/:id/toggle`
- `DELETE /api/shopping-items/:id`
- `GET /api/admin/database`
- `DELETE /api/admin/users/:id`

The backend should use session cookies or JWT tokens and must always filter normal user records by the authenticated `user_id`. Admin-only endpoints should check `role = 'admin'`.

## MySQL Notes

Run `database/schema.sql` in MySQL to create the database structure. Passwords must be stored as bcrypt hashes in the real backend, not plain text.

The H5 prototype does not connect directly to MySQL because browser code should not contain database credentials. Use Flask as the API layer between the frontend and MySQL.
