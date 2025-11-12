# VoiceCloneApp 部署指南

## 打包说明

### 文件结构要求
```
VoiceCloneApp.exe          # 主程序
checkpoints/               # 模型文件目录（必须）
  ├── bpe.model
  ├── gpt.pth
  ├── config.yaml
  ├── s2mel.pth
  ├── wav2vec2bert_stats.pt
  └── hub/                 # HuggingFace缓存
feature_cache/             # 音色库（可选）
examples/                  # 示例文件（可选）
```

### 打包步骤

1. **运行打包脚本**
   ```cmd
   build.bat
   ```

2. **检查生成文件**
   - `dist/VoiceCloneApp.exe` - 主程序
   - `build/` - 临时构建目录
   - `dist/` - 输出目录

3. **部署文件**
   - 将 `VoiceCloneApp.exe` 复制到目标目录
   - 确保 `checkpoints` 目录与exe文件在同一目录
   - 可选：复制 `feature_cache` 和 `examples` 目录

## 运行说明

### 命令行参数
```cmd
VoiceCloneApp.exe [选项]

选项:
  --port PORT        端口号 (默认: 6006)
  --host HOST        主机地址 (默认: 0.0.0.0)
  --model_dir DIR    模型目录 (默认: ./checkpoints)
  --verbose          详细模式
  --no-fp16          禁用FP16
  --no-deepspeed     禁用DeepSpeed
  --no-cuda-kernel   禁用CUDA内核
```

### 示例用法
```cmd
# 默认配置运行
VoiceCloneApp.exe

# 指定端口和模型目录
VoiceCloneApp.exe --port 8080 --model_dir D:\models

# 详细模式运行
VoiceCloneApp.exe --verbose
```

## 注意事项

### 1. 模型文件
- `checkpoints` 目录必须包含所有必需的模型文件
- 首次运行会初始化模型，可能需要较长时间
- 模型文件较大，建议使用SSD存储

### 2. 网络访问
- 默认监听所有网络接口 (0.0.0.0)
- 防火墙需要开放指定端口
- 可通过浏览器访问: http://localhost:6006

### 3. 性能优化
- 建议使用GPU运行以获得最佳性能
- 可调整 `--fp16`、`--deepspeed` 参数
- 大模型加载需要足够的内存

### 4. 故障排除

**常见问题:**
- **模型加载失败**: 检查checkpoints目录完整性
- **端口被占用**: 使用 `--port` 指定其他端口
- **内存不足**: 关闭其他程序，增加虚拟内存
- **GPU不可用**: 使用CPU模式运行

**日志查看:**
- 程序会在控制台输出运行日志
- 详细模式 (`--verbose`) 提供更多调试信息

## 更新说明

### 版本 1.0
- 初始发布版本
- 支持TTS语音克隆功能
- 提供Web界面和API接口
- 支持音色库管理