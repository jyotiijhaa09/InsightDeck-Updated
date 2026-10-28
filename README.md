# InsightDeck – Data Insights Dashboard

InsightDeck is a full-stack web application developed to provide an interactive and user-friendly experience for exploring data and insights. It combines a modern React frontend, a FastAPI backend, and Firebase for database services.

## 🚀 Project Overview

InsightDeck demonstrates full-stack web development by integrating a React-based frontend with a Python FastAPI backend and Firebase. The project focuses on creating an accessible interface, connecting application components, and managing data using Firebase.

## ✨ Features

- **Interactive User Interface:** A modern frontend built using React and Vite.
- **FastAPI Backend:** Handles backend operations and API requests.
- **Firebase Integration:** Uses Firebase for database services.
- **Frontend–Backend Communication:** Connects frontend components with backend APIs.
- **API Documentation:** FastAPI provides interactive API documentation.
- **Cloud Deployment:** Supports deploying the frontend and backend using suitable hosting platforms.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| Vite | Frontend development and build tool |
| Python | Backend programming |
| FastAPI | Backend API development |
| Uvicorn | Running the FastAPI application |
| Firebase | Database and cloud services |
| Git & GitHub | Version control and source code management |
| Vercel | Frontend deployment |
| Render | Backend deployment |

## 📂 Project Structure

```text
InsightDeck-Updated/
│
├── .github/
├── InsightDeck/
│   ├── Frontend/
│   └── Backend/
│
├── package-lock.json
└── README.md
```

*Note: Update the folder names above if your actual repository uses a different structure.*

## ⚙️ Installation and Setup

### Prerequisites

- Python
- Node.js and npm
- Git
- A Firebase project with the required services configured

### 1. Clone the Repository

```bash
git clone https://github.com/jyotiijhaa09/InsightDeck-Updated.git
cd InsightDeck-Updated
```

### 2. Set Up the Backend

Navigate to your backend directory:

```bash
cd InsightDeck/Backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server, assuming your application entry point is `main.py`:

```bash
uvicorn main:app --reload
```

The backend will generally be available at:

`http://localhost:8000`

FastAPI interactive documentation:

`http://localhost:8000/docs`

### 3. Set Up the Frontend

Open another terminal and navigate to the frontend directory:

```bash
cd InsightDeck/Frontend
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal, usually:

`http://localhost:5173`

*Note: Adjust the paths and commands according to your actual folder structure.*

## 🔥 Firebase Integration

Firebase is used for database services in InsightDeck.

Firebase integration can support:

- Storing and retrieving application data.
- Connecting application features to cloud database services.
- Managing data through the configured Firebase project.

The exact functionality depends on the Firebase services implemented in the application.

**Security note:** Keep private credentials and service account keys out of GitHub. Configure sensitive backend credentials using environment variables and appropriate deployment settings.

## 🌐 Deployment

The project uses cloud hosting platforms for deployment.

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Firebase

Add your active deployment links below:

- **Live Website:** [Add your frontend URL]
- **Backend API:** [Add your backend URL]

Ensure that the frontend uses the correct backend API URL and that the backend is configured to communicate with the required Firebase services.

## 🎯 Project Objectives

- Build a full-stack web application.
- Integrate React with FastAPI.
- Use Firebase for database services.
- Develop and connect backend APIs.
- Gain practical experience with GitHub and cloud deployment.

## 🔮 Future Enhancements

- Introduce additional data visualization features.
- Improve dashboard functionality.
- Enhance application performance and error handling.
- Expand API functionality.
- Add automated testing and CI/CD workflows.

## 👩‍💻 Author

**Jyoti Jha**

GitHub: [jyotiijhaa09](https://github.com/jyotiijhaa09)

---

⭐ If you find this project interesting, consider giving the repository a star!
