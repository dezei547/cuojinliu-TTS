import os
import sys
import json
import time
import threading
import html
from flask import Flask, request, jsonify, send_file
import warnings
import argparse
from indextts.infer_v2 import IndexTTS2
from tools.i18n.i18n import I18nAuto
from datetime import datetime

# 忽略警告
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# 解析命令行参数
parser = argparse.ArgumentParser(
    description="IndexTTS API Service",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument("--verbose", action="store_true", default=False, help="Enable verbose mode")
parser.add_argument("--port", type=int, default=6006, help="Port to run the API on")
parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the API on")
parser.add_argument("--model_dir", type=str, default="./checkpoints", help="Model checkpoints directory")
parser.add_argument("--fp16", action="store_true", default=True, help="Use FP16 for inference if available")
parser.add_argument("--deepspeed", action="store_true", default=True, help="Use DeepSpeed to accelerate if available")
parser.add_argument("--cuda_kernel", action="store_true", default=True, help="Use CUDA kernel for inference if available")
parser.add_argument("--gui_seg_tokens", type=int, default=120, help="Max tokens per generation segment")
cmd_args = parser.parse_args()

# 设置Hugging Face缓存目录为本地hub目录
os.environ["TRANSFORMERS_CACHE"] = os.path.join(cmd_args.model_dir, "hub")
os.environ["HF_HOME"] = os.path.join(cmd_args.model_dir, "hub")  # 统一HF相关工具的缓存路径

# 启用离线模式
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

# 检查模型目录和文件
if not os.path.exists(cmd_args.model_dir):
    print(f"Model directory {cmd_args.model_dir} does not exist. Please download the model first.")
    sys.exit(1)

required_files = [
    "bpe.model",
    "gpt.pth",
    "config.yaml",
    "s2mel.pth",
    "wav2vec2bert_stats.pt"
]

for file in required_files:
    file_path = os.path.join(cmd_args.model_dir, file)
    if not os.path.exists(file_path):
        print(f"Required file {file_path} does not exist. Please download it.")
        sys.exit(1)

# 初始化应用
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['EXAMPLES_FOLDER'] = 'examples'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# 创建必要的目录
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['OUTPUT_FOLDER'], 'tasks'), exist_ok=True)
os.makedirs('prompts', exist_ok=True)

# 初始化TTS模型和国际化
i18n = I18nAuto(language="Auto")
tts = IndexTTS2(
    model_dir=cmd_args.model_dir,
    cfg_path=os.path.join(cmd_args.model_dir, "config.yaml"),
    use_fp16=cmd_args.fp16,
    use_deepspeed=cmd_args.deepspeed,
    use_cuda_kernel=cmd_args.cuda_kernel,
)

# 情感选项
EMO_CHOICES_ALL = [
    "与音色之范相同",  # 内部使用
    "调整情绪"
]
EMO_CHOICES_OFFICIAL = EMO_CHOICES_ALL  # 全部为正式功能

# 加载示例案例
example_cases = []
examples_path = os.path.join(app.config['EXAMPLES_FOLDER'], "cases.jsonl")
if os.path.exists(examples_path):
    with open(examples_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            example = json.loads(line)
            
            # 处理示例音频路径
            if example.get("emo_audio"):
                emo_audio_path = os.path.join(app.config['EXAMPLES_FOLDER'], example["emo_audio"])
            else:
                emo_audio_path = None

            # 确保情感模式仅为0或1
            emo_mode_index = example.get("emo_mode", 0)
            emo_mode_index = 0 if emo_mode_index != 1 else 1  # 强制仅保留两种模式
            emo_mode_name = EMO_CHOICES_ALL[emo_mode_index]

            example_cases.append({
                "prompt_audio": os.path.join(app.config['EXAMPLES_FOLDER'], example.get("prompt_audio", "sample_prompt.wav")),
                "emo_mode": emo_mode_name,
                "text": example.get("text"),
                "emo_audio": emo_audio_path,
                "emo_weight": example.get("emo_weight", 1.0),
                "emo_text": example.get("emo_text", ""),
                "emo_vec": [
                    example.get("emo_vec_1", 0),
                    example.get("emo_vec_2", 0),
                    example.get("emo_vec_3", 0),
                    example.get("emo_vec_4", 0),
                    example.get("emo_vec_5", 0),
                    example.get("emo_vec_6", 0),
                    example.get("emo_vec_7", 0),
                    example.get("emo_vec_8", 0),
                ]
            })

# 线程锁确保生成过程线程安全
mutex = threading.Lock()

def get_example_cases(include_experimental=False):
    """获取示例案例"""
    return example_cases

@app.route('/api/generate', methods=['POST'])
def generate_audio():
    """生成音频的API端点"""
    with mutex:
        try:
            # 获取表单数据
            emo_control_method = int(request.form.get('emo_control_method', 0))  # 0=默认，1=调整情绪
            text = request.form.get('text', '')
            
            # 处理上传的参考音频
            prompt_audio_path = None
            if 'prompt_audio' in request.files and request.files['prompt_audio'].filename != '':
                file = request.files['prompt_audio']
                filename = f"prompt_{int(time.time())}_{file.filename}"
                prompt_audio_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(prompt_audio_path)
            elif request.form.get('prompt_audio_example'):
                # 使用示例音频
                prompt_audio_path = request.form.get('prompt_audio_example')
            
            # 情感向量 - 仅当调整情绪时有效
            vec = None
            if emo_control_method == 1:
                vec = [
                    float(request.form.get('vec1', 0.0)),
                    float(request.form.get('vec2', 0.0)),
                    float(request.form.get('vec3', 0.0)),
                    float(request.form.get('vec4', 0.0)),
                    float(request.form.get('vec5', 0.0)),
                    float(request.form.get('vec6', 0.0)),
                    float(request.form.get('vec7', 0.0)),
                    float(request.form.get('vec8', 0.0)),
                ]
                vec = tts.normalize_emo_vec(vec, apply_bias=True)
            
            # 高级参数
            max_text_tokens_per_segment = int(request.form.get('max_text_tokens_per_segment', 120))
            do_sample = request.form.get('do_sample', 'true').lower() == 'true'
            top_p = float(request.form.get('top_p', 0.8))
            top_k = int(request.form.get('top_k', 30))
            temperature = float(request.form.get('temperature', 0.8))
            length_penalty = float(request.form.get('length_penalty', 0.0))
            num_beams = int(request.form.get('num_beams', 3))
            repetition_penalty = float(request.form.get('repetition_penalty', 10.0))
            max_mel_tokens = int(request.form.get('max_mel_tokens', 1500))
            
            # 设置输出路径
            output_path = os.path.join(app.config['OUTPUT_FOLDER'], f"spk_{int(time.time())}.wav")
            
            # 准备参数
            kwargs = {
                "do_sample": do_sample,
                "top_p": top_p,
                "top_k": top_k if top_k > 0 else None,
                "temperature": temperature,
                "length_penalty": length_penalty,
                "num_beams": num_beams,
                "repetition_penalty": repetition_penalty,
                "max_mel_tokens": max_mel_tokens,
            }
            
            # 调用TTS生成
            output = tts.infer(
                spk_audio_prompt=prompt_audio_path,
                text=text,
                output_path=output_path,
                emo_vector=vec,  # 仅调整情绪时生效
                verbose=cmd_args.verbose,
                max_text_tokens_per_segment=max_text_tokens_per_segment,** kwargs
            )
            
            # 返回生成的音频路径
            return jsonify({
                'status': 'success',
                'audio_path': output.replace(app.root_path, ''),
                'audio_url': f"/api/outputs/{os.path.basename(output)}"
            })
            
        except Exception as e:
            app.logger.error(f"生成音频时出错: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

@app.route('/api/segment-text', methods=['POST'])
def segment_text():
    """文本分句API"""
    try:
        text = request.json.get('text', '')
        max_tokens = int(request.json.get('max_tokens', 120))
        
        if not text:
            return jsonify({'segments': []})
            
        text_tokens_list = tts.tokenizer.tokenize(text)
        segments = tts.tokenizer.split_segments(text_tokens_list, max_text_tokens_per_segment=max_tokens)
        
        result = []
        for i, seg in enumerate(segments):
            segment_str = ''.join(seg)
            result.append({
                'index': i,
                'text': segment_str,
                'tokens': len(seg)
            })
            
        return jsonify({'segments': result})
    except Exception as e:
        app.logger.error(f"文本分句时出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-examples', methods=['GET'])
def get_examples():
    """获取示例案例API"""
    include_experimental = request.args.get('experimental', 'false').lower() == 'true'
    return jsonify(get_example_cases(include_experimental))

@app.route('/api/get-emo-choices', methods=['GET'])
def get_emo_choices():
    """获取情感选项API"""
    include_experimental = request.args.get('experimental', 'false').lower() == 'true'
    return jsonify(EMO_CHOICES_ALL if include_experimental else EMO_CHOICES_OFFICIAL)

@app.route('/api/uploads/<path:filename>')
def uploaded_file(filename):
    """提供上传文件的访问"""
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename))

@app.route('/api/outputs/<path:filename>')
def output_file(filename):
    """提供输出文件的访问"""
    return send_file(os.path.join(app.config['OUTPUT_FOLDER'], filename))

@app.route('/api/examples/<path:filename>')
def example_file(filename):
    """提供示例文件的访问"""
    return send_file(os.path.join(app.config['EXAMPLES_FOLDER'], filename))

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'model_version': tts.model_version or '1.0',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(host=cmd_args.host, port=cmd_args.port, threaded=True)
