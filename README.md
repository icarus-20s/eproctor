# Proctoring System

This project is a web-based proctoring system built using Flask for the backend and React for the frontend. It allows users to create and take tests with automated proctoring capabilities, such as monitoring user behavior during the test.

## Table of Contents
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
- [Backend Setup (Flask)](#backend-setup-flask)
- [Frontend Setup (React)](#frontend-setup-react)
- [Running the Application](#running-the-application)

## Features

- **Test Creation:** Instructors can create tests with multiple-choice questions.
- **Proctoring:** Automated proctoring features include monitoring camera feeds, tracking tab switches, and detecting unusual behavior.
- **User Authentication:** Secure login and registration for students and instructors.
- **Timer Functionality:** Each test can have a time limit.
- **Results Management:** Submissions are recorded, and results can be reviewed.

## Technologies Used

- **Frontend:** React, JavaScript, HTML, CSS
- **Backend:** Python, Flask
- **Database:** SQLite (default), can be replaced with PostgreSQL/MySQL
- **Other Libraries:** Axios (for API calls), OpenCV (for camera monitoring), WebSockets (for real-time updates)

## Getting Started

### Prerequisites
Make sure you have the following installed:
- Python (>=3.8)
- Node.js (>=14.x)
- npm (Node Package Manager)

## Backend Setup (Flask)

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/proctoring-system.git
   cd proctoring-system/backend
    ```
    Create a Virtual Environment

2. **Create a Virtual Environment**
```bash
python -m venv venv
Activate the Virtual Environment
```

On Windows:
```bash
venv\Scripts\activate
```

On macOS/Linux:
```bash
source venv/bin/activate
```


3. **Install Backend Dependencies**

```bash
pip install -r requirements.txt
```
4. **Run the Flask Server**

```bash
python app.py
```
The Flask server will be running at http://127.0.0.1:5000.

# Frontend Setup (React)

Install Frontend Dependencies

```bash
npm install
```
Start the React Development Server

```bash
npm start
The React app will be running at http://localhost:3000.
```

# Running the Application
Start the Flask Backend

# Run the command python app.py from the backend directory.
Start the React Frontend

# Run the command npm start from the frontend directory.
Access the Application

Open a web browser and navigate to http://localhost:3000 to interact with the frontend.
The frontend will communicate with the Flask backend running at http://127.0.0.1:5000.
Project Structure
The project is divided into two main folders:

backend/ - Contains the Flask backend code.