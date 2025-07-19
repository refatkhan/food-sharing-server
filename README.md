# 🍽️ Food Sharing Platform — Backend (Express + MongoDB)

This is the **server-side** of the Food Sharing Platform. It provides a RESTful API for managing donated food, handling food requests, and user-specific data. Built with **Express.js** and **MongoDB**, and optionally secured with Firebase Authentication tokens.

---

## 🚀 Features

- 🍽 Add & Retrieve Food Listings
- 🌟 Get Featured Foods (Top 6 by quantity)
- 🙋 Request Food
- 🧾 Manage Food Requests
- 🔒 Secured endpoints with Firebase auth (optional)
- 🌐 Deployed using Vercel / Render / Railway (based on your choice)

---

## 🛠 Tech Stack

| Layer    | Technology         |
|----------|--------------------|
| Server   | Node.js + Express  |
| Database | MongoDB (Atlas)    |
| Auth     | Firebase Token (optional) |
| Hosting  | Vercel / Render / Railway |

---

## 📁 Project Structure

```
/server
├── index.js               # Main Express server
├── .env                   # Environment variables (Mongo URI, etc.)
├── package.json           # Dependencies and scripts
└── ...
```

---

## 📦 API Endpoints

| Method | Route                       | Description                        |
|--------|----------------------------|------------------------------------|
| GET    | `/all-foods`               | Get all food items                 |
| GET    | `/food-featured`           | Get top 6 foods sorted by quantity |
| GET    | `/food/:email`             | Get all foods by a user's email    |
| POST   | `/add-food`                | Add a food item                    |
| DELETE | `/food/:id`                | Delete a food item                 |
| PUT    | `/food/:id`                | Update a food item                 |
| POST   | `/request-food`            | Request a food item                |
| GET    | `/requested-foods`         | Get all food requests              |

---

## 🌐 Environment Variables

Create a `.env` file in your root:

```env
PORT=3000
MONGODB_URI=mongodb+srv://your_mongo_uri
```

---

## ▶️ Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run the server
node index.js

# OR with nodemon (dev)
npx nodemon index.js
```

The server will run on:
```
http://localhost:3000
```

---

## 🔐 Firebase Authentication (Optional)

To secure APIs:
1. Verify Firebase token from client headers:

```js
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send("Unauthorized");

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).send("Forbidden");
  }
};
```

2. Apply `verifyToken` middleware to sensitive routes.

---

## 🚀 Deployment (Render Recommended)

### 🌍 Deploy to [Render](https://render.com)

1. Create a free account
2. Create a new **Web Service**
3. Connect your GitHub repo
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - Add `.env` values in Environment tab

You'll get a live backend URL like:
```
https://your-backend.onrender.com
```

---

## 🧑‍💻 Author

**Refat Khan**  
Backend Developer – Assignment 11, Food Sharing Platform

---

## 📄 License

MIT
