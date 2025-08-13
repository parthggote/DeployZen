# DeployZen Platform

A full-stack web platform for AI-powered testing and LLM model deployment. Built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Features

### 🔹 Model Management
- **Upload Models**: Support for .gguf, .bin files and HuggingFace URLs
- **Deployment Options**: Ollama and llama.cpp integration
- **Configuration**: Customizable tokens, batch size, threads, and stream mode
- **Real-time Status**: Monitor model deployment and running status
- **Testing**: Built-in model testing with latency tracking

### 🔹 API Testing
- **File Upload**: Support for JS, TS, Python, and OpenAPI/Swagger files
- **AI Test Generation**: Automatic test case generation using AI analysis
- **Test Execution**: Run generated tests with real-time progress tracking
- **Results Display**: Detailed test results with pass/fail status and execution times
- **Expandable Details**: View test code, results, and error messages

### 🔹 Dashboard & Monitoring
- **Real-time Stats**: Live metrics for APIs, models, and test success rates
- **Model Monitoring**: Performance metrics, latency, and activity tracking
- **Auto-refresh**: Automatic data updates every 30 seconds
- **Status Tracking**: Visual status indicators for all deployments

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Backend**: Next.js API routes
- **Data Storage**: Local file system (JSON files)
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd deployzen-platform
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Prerequisites

### For Model Deployment
- **Ollama**: Install from [ollama.ai](https://ollama.ai)
- **llama.cpp**: Compile from [github.com/ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp)

### For API Testing
- **Node.js**: Version 18 or higher
- **Python**: Version 3.8 or higher (for Python API testing)

## 📁 Project Structure

```
deployzen-platform/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── models/        # Model management APIs
│   │   └── apis/          # API testing endpoints
│   ├── dashboard/         # Dashboard pages
│   │   ├── upload-model/  # Model upload page
│   │   ├── upload-api/    # API upload page
│   │   └── monitoring/    # Monitoring dashboard
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── *.tsx             # Feature-specific components
├── lib/                  # Utility functions
├── data/                 # Local data storage (auto-generated)
└── public/               # Static assets
```

## 🎯 Usage Guide

### Deploying Models

1. **Navigate to Upload Model**
   - Go to Dashboard → Upload Model

2. **Choose Upload Method**
   - **File Upload**: Select .gguf or .bin files
   - **HuggingFace URL**: Paste model URL

3. **Configure Settings**
   - Model name
   - Deployment mode (Ollama/llama.cpp)
   - Max tokens, batch size, threads
   - Stream mode toggle

4. **Deploy**
   - Click "Deploy Model"
   - Monitor deployment progress
   - View model status and test results

### Testing APIs

1. **Upload API**
   - Go to Dashboard → Upload API
   - Drag & drop API files or paste code
   - Add optional description

2. **Generate Tests**
   - Click "Generate Tests"
   - AI analyzes your API and creates test cases
   - Review generated test scenarios

3. **Execute Tests**
   - Click "Execute Tests"
   - Monitor test execution progress
   - View detailed results and errors

### Monitoring

1. **Dashboard Overview**
   - View real-time stats
   - See deployed models and APIs
   - Monitor test success rates

2. **Live Monitoring**
   - Real-time performance metrics
   - Model activity tracking
   - System health status

## 🔌 API Endpoints

### Models
- `GET /api/models` - List all models
- `POST /api/models/deploy` - Deploy new model
- `POST /api/models/test` - Test model with prompt
- `DELETE /api/models/[id]` - Delete model
- `GET /api/models/logs` - Get activity logs

### APIs
- `GET /api/apis` - List all APIs
- `POST /api/apis` - Upload new API
- `POST /api/apis/generate-tests` - Generate test cases
- `POST /api/apis/execute-tests` - Execute tests

## 🎨 Customization

### Themes
The platform supports dark/light mode with automatic system detection.

### Components
All UI components are built with Radix UI primitives and can be customized via Tailwind CSS.

### Styling
- Primary colors and theme variables in `tailwind.config.ts`
- Component styles in `components/ui/`
- Global styles in `app/globals.css`

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Set environment variables
3. Deploy automatically on push

### Self-hosted
1. Build the application: `pnpm build`
2. Start production server: `pnpm start`
3. Configure reverse proxy (nginx/Apache)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: Create an issue on GitHub
- **Documentation**: Check the activity log for recent changes
- **Community**: Join our Discord server

## 🔄 Recent Updates

See `activity_log.md` for detailed development history and recent changes.

---

**DeployZen** - AI-Powered Testing and LLM Deployment Platform 