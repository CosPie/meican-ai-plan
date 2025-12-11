# 🍱 Meican AI Planner (美餐 AI 规划师)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/frontend-React-61DAFB.svg)
![Hono](https://img.shields.io/badge/backend-Hono-E36002.svg)
![Docker](https://img.shields.io/badge/deployment-Docker-2496ED.svg)

[English](./README.md) | [简体中文](./README_zh-CN.md)

**Meican AI Planner** 是一款智能 AI 助手，旨在自动化和优化您在美餐平台上的订餐体验。它结合了美观现代的界面与强大的 AI 算法，帮助您轻松规划每周膳食、追踪营养摄入并管理订单。

---

## ✨ 功能特性

- **🤖 AI 自动规划**：根据您的饮食偏好智能生成每周膳食计划，自动避开不喜欢的食材并优先选择您喜爱的商家。支持 Google Gemini 和自定义 OpenAI 兼容模型。
- **📅 可视化日历**：清晰的交互式周视图，方便管理早餐、午餐和晚餐时段。
- **⚡ 智能订餐**：通过美餐 API 直接自动化订餐流程。
- **📊 分析仪表盘**：通过交互式图表可视化您的消费习惯和营养摄入情况。
- **🎨 现代 UI**：使用 React、TailwindCSS 和 Framer Motion 构建的流畅、响应式界面。
- **🌍 多语言支持**：完全支持英文和中文界面。
- **🔒 隐私专注**：您的凭据和偏好设置仅存储在本地或通过代理安全处理。

## 🛠️ 技术栈

- **前端**：[React](https://react.dev/), [Vite](https://vitejs.dev/), [TailwindCSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Recharts](https://recharts.org/)
- **后端**：[Hono](https://hono.dev/), [Node.js](https://nodejs.org/)
- **AI 集成**：Google Gemini API, OpenAI API
- **部署**：Docker, Docker Compose

## 🚀 快速开始

### 前置要求

- 您的机器上已安装 [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)。
- 一个美餐账号。
- (可选) 用于 AI 功能的 Google Gemini API Key 或 OpenAI 兼容的 API Key。

### 安装步骤

1.  **克隆仓库**
    ```bash
    git clone https://github.com/yourusername/meican-ai-planner.git
    cd meican-ai-planner
    ```

2.  **启动应用**
    运行以下命令以启动前端和后端服务：
    ```bash
    docker-compose up -d
    ```

3.  **访问应用**
    打开浏览器并访问：
    ```
    http://localhost:3000
    ```

## 📖 使用指南

1.  **登录**：在登陆页面输入您的美餐账号密码或 Session ID。
2.  **配置设置**：点击设置图标配置您的 AI 提供商 (Gemini/OpenAI)、排除关键词 (如 "香菜", "辣") 和商家偏好。
3.  **AI 规划**：点击 "AI 自动规划" 按钮，让 AI 为您建议下周的膳食。
4.  **查看与下单**：在日历视图中查看建议。点击任何时段可手动修改订单。
5.  **分析**：使用分析标签页查看您的订餐历史和统计数据。

## 🔧 开发

如果您想在本地运行项目进行开发：

### 前端
```bash
# 安装依赖
bun install

# 启动开发服务器
bun dev
```

### 后端
```bash
cd backend

# 安装依赖
bun install

# 启动开发服务器
bun dev
```

## 📄 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。

---

<p align="center">
  由 <a href="https://github.com/yourusername">Your Name</a> 用 ❤️ 制作
</p>
