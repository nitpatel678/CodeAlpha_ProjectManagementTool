# CodeAlpha_ProjectManagementTool
# 📂 ZipConnect

A **Project Collaboration & Management Tool** built as part of the **CodeAlpha Full-Stack Internship (1 Month)**.
ZipConnect helps teams create projects, assign tasks, track progress, and stay connected with notifications and comments.

---

## 🚀 Features

* 🗂️ **Create Group Projects** – Start and manage collaborative projects
* ✅ **Task Management** – Create tasks, assign them to members, and track updates
* 📊 **Task Progress & Priority** – Update status and set priorities for better workflow
* 💬 **Comment System** – Chat and discuss within projects
* 🔔 **Notifications** – Get alerts when new updates or comments are added
* 🔐 **Login/Signup Authentication** – Secure access with user accounts

---

## 🛠️ Tech Stack

* **Frontend**: HTML, CSS, JavaScript (located in `public/` folder)
* **Backend**: Node.js, Express.js
* **Database**: MongoDB

---

## ⚙️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ZipConnect.git
cd ZipConnect
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory and add your MongoDB connection string:

```
MONGODB_URI=your_mongodb_connection_string_here
PORT=5000
JWT_SECRET=your_secret_key
```

---

## ▶️ Running the Project

### Backend

```bash
npm start
```

or with nodemon:

```bash
npx nodemon server.js
```

Backend runs at:

```
http://localhost:5000
```

### Frontend

* Static **HTML, CSS, and JS** files are served from the `public/` folder.
* Access frontend in browser at:

```
http://localhost:3000
```



## 👨‍💻 Author

Developed by **Nitin Patel** as part of **CodeAlpha Full Stack Internship** 🚀

