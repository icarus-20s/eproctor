# Proctoring System

A web-based proctoring system built with **Flask** (backend) and **React** (frontend) that enables secure test-taking with automated monitoring features.

---

## Table of Contents

* [Features](#features)
* [Tech Stack](#tech-stack)
* [Getting Started](#getting-started)
* [Backend Setup](#backend-setup)
* [Frontend Setup](#frontend-setup)
* [Running the Application](#running-the-application)
* [Project Structure](#project-structure)

---

## Features

* **Test Creation:** Instructors can create multiple-choice tests.
* **Proctoring:** Automatically monitors users via webcam, tab-switch tracking, and unusual activity detection.
* **Authentication:** Secure login system for students and instructors.
* **Test Timer:** Supports timed exams.
* **Result Management:** Stores and displays student results.

---

## Tech Stack

* **Frontend:** React, HTML, CSS, JavaScript
* **Backend:** Flask (Python)
* **Database:** SQLite (can switch to PostgreSQL/MySQL)
* **Libraries & Tools:** Axios, OpenCV, WebSockets

---

## Getting Started

### Prerequisites

Ensure the following are installed:

* Python 3.8+
* Node.js 14+
* npm

---

## Backend Setup

1. **Clone the Repository**

   ```bash
   git clone https://github.com/your-username/proctoring-system.git
   cd proctoring-system/backend
   ```

2. **Create and Activate Virtual Environment**

   **Windows:**

   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```

   **macOS/Linux:**

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Run Flask Server**

   ```bash
   python app.py
   ```

   Server will run at `http://127.0.0.1:5000`.

---

## Frontend Setup

1. **Navigate to Frontend Directory**

   ```bash
   cd ../frontend
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Start React App**

   ```bash
   npm start
   ```

   App will run at `http://localhost:3000`.

---

## Running the Application

1. **Start Flask Backend**
   Run `python app.py` from the `backend/` folder.

2. **Start React Frontend**
   Run `npm start` from the `frontend/` folder.

3. **Access the App**
   Open your browser and go to `http://localhost:3000`.

---

## Project Structure

```
proctoring-system/
│
├── backend/      # Flask backend
│   └── app.py    # Main server file
│
└── frontend/     # React frontend
    └── src/      # React source files
```

---

Let me know if you want to add screenshots, deployment steps, or API documentation.
