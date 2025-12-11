# 🍱 Meican AI Planner

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/frontend-React-61DAFB.svg)
![Hono](https://img.shields.io/badge/backend-Hono-E36002.svg)
![Docker](https://img.shields.io/badge/deployment-Docker-2496ED.svg)

[English](./README.md) | [简体中文](./README_zh-CN.md)

**Meican AI Planner** is a smart, AI-powered assistant designed to automate and optimize your meal ordering experience on the Meican platform. It combines a beautiful, modern interface with powerful AI algorithms to help you plan your weekly meals, track nutrition, and manage orders effortlessly.

---

## ✨ Features

- **🤖 AI Auto-Planning**: intelligently generates weekly meal plans based on your dietary preferences, avoiding disliked ingredients and prioritizing your favorite vendors. Supports Google Gemini and custom OpenAI-compatible models.
- **📅 Visual Calendar**: A clear, interactive weekly view to manage your breakfast, lunch, and dinner slots.
- **⚡ Smart Ordering**: Automates the ordering process directly through the Meican API.
- **📊 Analysis Dashboard**: Visualize your spending habits and nutritional intake with interactive charts.
- **🎨 Modern UI**: A sleek, responsive interface built with React, TailwindCSS, and Framer Motion for smooth animations.
- **🌍 Multi-language Support**: Fully localized for English and Chinese users.
- **🔒 Privacy Focused**: Your credentials and preferences are stored locally or handled securely via a proxy.

## 🛠️ Tech Stack

- **Frontend**: [React](https://react.dev/), [Vite](https://vitejs.dev/), [TailwindCSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Recharts](https://recharts.org/)
- **Backend**: [Hono](https://hono.dev/), [Node.js](https://nodejs.org/)
- **AI Integration**: Google Gemini API, OpenAI API
- **Deployment**: Docker, Docker Compose

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.
- A Meican account.
- (Optional) A Google Gemini API key or an OpenAI-compatible API key for AI features.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/meican-ai-planner.git
    cd meican-ai-planner
    ```

2.  **Start the application**
    Run the following command to start both the frontend and backend services:
    ```bash
    docker-compose up -d
    ```

3.  **Access the App**
    Open your browser and navigate to:
    ```
    http://localhost:3000
    ```

## 📖 Usage

1.  **Login**: Enter your Meican credentials or Session ID on the landing page.
2.  **Configure Settings**: Click the settings icon to set up your AI provider (Gemini/OpenAI), excluded keywords (e.g., "cilantro", "spicy"), and vendor preferences.
3.  **AI Plan**: Click the "AI Auto Plan" button to let the AI suggest meals for the upcoming week.
4.  **Review & Order**: Review the suggestions in the calendar view. Click on any slot to modify the order manually.
5.  **Analyze**: Use the Analysis tab to check your ordering history and stats.

## 🔧 Development

If you want to run the project locally for development:

### Frontend
```bash
# Install dependencies
bun install

# Start dev server
bun dev
```

### Backend
```bash
cd backend

# Install dependencies
bun install

# Start dev server
bun dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/yourusername">CosPie</a>
</p>
