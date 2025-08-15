# Vercel Deployment Guide for DeployZen Platform

## Overview
This guide explains how to deploy the DeployZen platform on Vercel with ONNX runtime CPU compatibility.

## 🚨 Important: ONNX Runtime Changes for Vercel

### Why the Change?
- **Original Issue**: `onnxruntime-node` includes GPU binaries that are incompatible with Vercel's serverless Linux environment
- **Solution**: Use `onnxruntime-node@cpu` which only includes CPU binaries
- **Benefit**: Eliminates build failures and ensures compatibility with Vercel's infrastructure

### What Changed?
1. **Package**: `onnxruntime-node` (CPU-only by default, no GPU binaries)
2. **Configuration**: Added Vercel-specific ONNX settings and optimizations
3. **Error Handling**: Added serverless environment detection and constraints
4. **Performance**: Optimized for CPU inference in serverless environments

## 🔧 Local Development Setup

### Step 1: Verify the current package
```bash
npm list onnxruntime-node
# Should show: onnxruntime-node@1.22.0
```

### Step 2: Ensure you have the correct version
```bash
npm install onnxruntime-node@1.22.0
```

### Step 3: Verify the installation
```bash
npm list onnxruntime-node
# Should show: onnxruntime-node@1.22.0
```

## 🚀 Vercel Deployment Steps

### Step 1: Prepare your repository
```bash
# Ensure all changes are committed
git add .
git commit -m "feat: switch to onnxruntime-node CPU for Vercel compatibility"
git push origin master
```

### Step 2: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository: `parthggote/DeployZen`
3. Vercel will automatically detect it's a Next.js project

### Step 3: Configure build settings
In your Vercel project settings, ensure:

**Build Command:**
```bash
npm run build
```

**Output Directory:**
```
.next
```

**Install Command:**
```bash
npm install
```

### Step 4: Set Environment Variables
Add these environment variables in your Vercel project:

```bash
# Security (Required)
SECRET_KEY=your_secure_random_secret_key_here

# Flask Configuration (if using Flask APIs)
FLASK_ENV=production
FLASK_DEBUG=false

# MongoDB (if using MongoDB)
MONGODB_URI=your_mongodb_connection_string
MONGODB_USERNAME=your_username
MONGODB_PASSWORD=your_password

# Vercel-specific
NODE_ENV=production
```

### Step 5: Deploy
1. Click "Deploy" in Vercel
2. Vercel will automatically build and deploy your application
3. Monitor the build logs for any issues

## 🔍 Troubleshooting Common Issues

### Issue: Build fails with ONNX-related errors
**Solution**: Ensure you're using `onnxruntime-node@1.22.0` (CPU-only by default) and not a GPU-enabled version.

### Issue: ONNX models fail to load
**Solution**: 
- Models must be accessible in the serverless environment
- Use cloud storage (AWS S3, Google Cloud Storage) for model files
- Ensure model paths are correct for the Vercel environment

### Issue: Memory limits exceeded
**Solution**:
- ONNX models consume significant memory
- Consider using Vercel Pro for higher memory limits
- Optimize model size or use model quantization

### Issue: Cold start performance
**Solution**:
- ONNX runtime initialization can be slow
- Consider using Vercel's Edge Functions for better performance
- Implement model caching strategies

## 📊 Performance Considerations

### CPU vs GPU Inference
- **CPU Inference**: Slower but more compatible with serverless environments
- **Memory Usage**: Higher memory consumption compared to GPU
- **Cold Start**: Initial model loading can take several seconds

### Optimization Tips
1. **Model Quantization**: Use quantized models (INT8) for faster inference
2. **Model Caching**: Implement session caching to avoid reloading
3. **Batch Processing**: Process multiple inputs together when possible
4. **Memory Management**: Monitor memory usage and optimize accordingly

## 🔒 Security Notes

### Environment Variables
- Never commit sensitive values to your repository
- Use Vercel's environment variable management
- Rotate secrets regularly

### Model Security
- Validate all input data before inference
- Implement rate limiting for inference endpoints
- Monitor for potential abuse

## 📝 Monitoring and Logs

### Vercel Analytics
- Monitor function execution times
- Track memory usage
- Identify performance bottlenecks

### Application Logs
- Use Vercel's function logs for debugging
- Implement structured logging in your application
- Monitor ONNX inference performance

## 🔄 Updating ONNX Runtime

### When to Update
- Security patches
- Performance improvements
- Bug fixes

### Update Process
```bash
# Check current version
npm list onnxruntime-node

# Update to latest version (CPU-only by default)
npm install onnxruntime-node@latest

# Test locally
npm run build
npm run dev

# Deploy to Vercel
git add .
git commit -m "chore: update onnxruntime-node CPU package"
git push origin master
```

## 📚 Additional Resources

- [ONNX Runtime Documentation](https://onnxruntime.ai/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [ONNX Model Optimization](https://onnxruntime.ai/docs/performance/model-optimizations/)

## 🆘 Support

If you encounter issues:

1. **Check Vercel build logs** for detailed error messages
2. **Verify package versions** match the requirements
3. **Test locally** before deploying
4. **Check ONNX model compatibility** with CPU runtime
5. **Review Vercel function limits** and constraints

---

**Note**: This deployment guide is specifically optimized for Vercel's serverless environment. For other deployment platforms, additional configuration may be required.
