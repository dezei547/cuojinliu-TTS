import os
import sys
import json
import time
import threading
import html
from flask import Flask, render_template, request, jsonify, send_file
import warnings
import pandas as pd
import argparse
from utils.infer_v2 import IndexTTS2
from tools.i18n.i18n import I18nAuto
from datetime import datetime
import os
import sqlite3
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from functools import wraps
from dotenv import load_dotenv
import requests 
# 忽略警告
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# 解析命令行参数
parser = argparse.ArgumentParser(
    description="IndexTTS WebUI",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument("--verbose", action="store_true", default=False, help="Enable verbose mode")
parser.add_argument("--port", type=int, default=6006, help="Port to run the web UI on")
parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the web UI on")
parser.add_argument("--model_dir", type=str, default="./checkpoints", help="Model checkpoints directory")
parser.add_argument("--fp16", action="store_true", default=True, help="Use FP16 for inference if available")
parser.add_argument("--deepspeed", action="store_true", default=True, help="Use DeepSpeed to accelerate if available")
parser.add_argument("--cuda_kernel", action="store_true", default=True, help="Use CUDA kernel for inference if available")
parser.add_argument("--gui_seg_tokens", type=int, default=120, help="GUI: Max tokens per generation segment")
cmd_args = parser.parse_args()
print(cmd_args.model_dir)
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
app = Flask(__name__, 
    template_folder='templates',
    static_folder='static'  # 明确指定静态文件夹
)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['EXAMPLES_FOLDER'] = 'examples'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
app.config['FEATURE_CACHE_FOLDER'] = 'feature_cache'
# 创建必要的目录
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['OUTPUT_FOLDER'], 'tasks'), exist_ok=True)
CORS(app)
os.makedirs('prompts', exist_ok=True)
# 配置上传目录（与原后端一致：项目根目录下的uploads）
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
# 确保上传目录存在（与原后端mkdirSync逻辑一致）
os.makedirs(UPLOAD_DIR, exist_ok=True)
# 配置文件大小限制（50MB，与原后端一致）
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB
# 允许的音频文件类型（与原后端一致：mp3、wav、aac）
ALLOWED_EXTENSIONS = {"mp3", "wav", "aac"}
ALLOWED_MIMETYPES = {"audio/mpeg", "audio/wav", "audio/aac", "audio/mp3"}

DB_PATH = "voice_library.db"
def get_db_connection():
    """创建并返回SQLite数据库连接（带行工厂，方便获取字典格式数据）"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 使查询结果可按列名访问（类似字典）
    return conn


def init_db():
    """初始化数据库表（与原后端表结构完全一致）"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 创建分类表（categories）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            voice_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. 创建音色表（voices），带外键关联分类
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS voices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category_id INTEGER NOT NULL,
            description TEXT,
            audio_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            duration REAL NOT NULL,
            is_favorite INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    ''')

    # 3. 插入初始分类（与原后端一致：古风、现代、自然、电子）
    # cursor.execute("SELECT id FROM categories WHERE name = '古风'")
    # if not cursor.fetchone():
    #     cursor.execute('''
    #         INSERT INTO categories (name, description) VALUES 
    #         ('古风', '具有中国传统风格的音色'),
    #         ('现代', '现代流行风格的音色'),
    #         ('自然', '来自自然界的声音'),
    #         ('电子', '电子合成的声音效果')
    #     ''')

    conn.commit()
    conn.close()
    print("SQLite数据库初始化完成（表创建+初始分类）")


# 应用启动时自动初始化数据库
init_db()


# ------------------------------
# 工具函数（文件验证、格式处理）
# ------------------------------
def allowed_file(filename, mimetype):
    """验证文件是否符合要求（扩展名+MIME类型，与原后端一致）"""
    # 检查扩展名
    ext = os.path.splitext(filename)[1].lower()[1:]  # 获取不带点的扩展名
    # 检查MIME类型（处理浏览器可能返回的不同MIME格式）
    valid_mimetype = any(mimetype.startswith(mt) for mt in ALLOWED_MIMETYPES)
    return ext in ALLOWED_EXTENSIONS and valid_mimetype


def get_current_time():
    """获取当前时间字符串（与SQLite TIMESTAMP格式一致）"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# 初始化TTS模型和国际化
i18n = I18nAuto(language="Auto")
tts = IndexTTS2(
    model_dir=cmd_args.model_dir,
    cfg_path=os.path.join(cmd_args.model_dir, "config.yaml"),
    use_fp16=cmd_args.fp16,
    use_deepspeed=cmd_args.deepspeed,
    use_cuda_kernel=cmd_args.cuda_kernel,
)

# 情感选项 - 仅保留核心功能
EMO_CHOICES_ALL = [
    "与音色之范相同",  # 内部使用，前端不显示
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

@app.route('/')
def index():
    """主页面路由"""
    current_year = datetime.now().year
    return render_template('index.html', 
                          emo_choices=EMO_CHOICES_OFFICIAL,
                          examples=get_example_cases(),
                          model_version=tts.model_version or '1.0',
                          max_mel_tokens=tts.cfg.gpt.max_mel_tokens,
                          initial_segment_value=max(20, min(tts.cfg.gpt.max_text_tokens, cmd_args.gui_seg_tokens)),
                          current_year=current_year,
                          tts=tts,
                          emo_choices_all=EMO_CHOICES_ALL
                         )
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 检查是否需要进行认证
        auth_token = request.headers.get('Authorization')
        
        if not auth_token:
            return jsonify({
                'status': 'error',
                'message': '请先登录'
            }), 401
        
        # 验证token有效性
        try:
            # 调用认证API验证token
            auth_response = requests.get(
                'http://39.101.72.163/api/validate',
                headers={'Authorization': auth_token},
                timeout=5
            )
            
            if auth_response.status_code != 200:
                return jsonify({
                    'status': 'error',
                    'message': '登录已过期，请重新登录'
                }), 401
                
            auth_data = auth_response.json()
            if auth_data.get('status') != 'success':
                return jsonify({
                    'status': 'error',
                    'message': '用户认证失败'
                }), 401
                
        except requests.exceptions.RequestException as e:
            app.logger.error(f"认证服务连接失败: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': '认证服务暂时不可用，请稍后重试'
            }), 503
            
        return f(*args, **kwargs)
    return decorated_function

@app.route('/generate', methods=['POST'])
@login_required
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
                print(f"上传参考音频: {prompt_audio_path}")
            elif request.form.get('prompt_audio_example'):
                # 使用音色库音频
                prompt_audio_path = request.form.get('prompt_audio_example')[1:]
                
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
                'audio_path': output.replace(app.root_path, '')
            })
            
        except Exception as e:
            app.logger.error(f"生成音频时出错: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

@app.route('/segment-text', methods=['POST'])
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

@app.route('/get-examples', methods=['GET'])
def get_examples():
    """获取示例案例API"""
    include_experimental = request.args.get('experimental', 'false').lower() == 'true'
    return jsonify(get_example_cases(include_experimental))

@app.route('/get-emo-choices', methods=['GET'])
def get_emo_choices():
    """获取情感选项API"""
    include_experimental = request.args.get('experimental', 'false').lower() == 'true'
    return jsonify(EMO_CHOICES_ALL if include_experimental else EMO_CHOICES_OFFICIAL)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """提供上传文件的访问"""
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename))

@app.route('/outputs/<path:filename>')
def output_file(filename):
    """提供输出文件的访问"""
    return send_file(os.path.join(app.config['OUTPUT_FOLDER'], filename))

@app.route('/examples/<path:filename>')
def example_file(filename):
    """提供示例文件的访问"""
    return send_file(os.path.join(app.config['EXAMPLES_FOLDER'], filename))
@app.route('/get-preset-voices', methods=['GET'])
def get_preset_voices():
    """获取feature_cache文件夹中的音频文件列表"""
    try:
        # 音频文件扩展名
        audio_extensions = ('.wav', '.mp3', '.ogg', '.flac', '.aac')
        
        # 获取feature_cache文件夹中的所有文件
        cache_folder = app.config['FEATURE_CACHE_FOLDER']
        voices = []
        
        if os.path.exists(cache_folder) and os.path.isdir(cache_folder):
            for filename in os.listdir(cache_folder):
                # 检查文件是否为音频文件
                if filename.lower().endswith(audio_extensions):
                    # 获取完整路径
                    file_path = os.path.join(cache_folder, filename)
                    
                    # 提取文件名（不含扩展名）作为显示名称
                    display_name = os.path.splitext(filename)[0]
                    
                    voices.append({
                        'name': display_name,
                        'path': file_path
                    })
        
        # 按名称排序
        voices.sort(key=lambda x: x['name'])
        
        return jsonify({
            'success': True,
            'voices': voices
        })
        
    except Exception as e:
        app.logger.error(f"获取预设音色列表时出错: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
# 替换原有的/get-preset-voices路由

@app.route('/get-categorized-voices', methods=['GET'])
def get_categorized_voices():
    """获取feature_cache文件夹中的音频文件列表，按分类组织"""
    try:
        # 音频文件扩展名
        audio_extensions = ('.wav', '.mp3', '.ogg', '.flac', '.aac')
        
        # 获取feature_cache文件夹中的所有文件
        cache_folder = app.config['FEATURE_CACHE_FOLDER']
        categories = {}
        
        if os.path.exists(cache_folder) and os.path.isdir(cache_folder):
            # 遍历文件夹
            for item in os.listdir(cache_folder):
                item_path = os.path.join(cache_folder, item)
                
                # 处理子文件夹（作为分类）
                if os.path.isdir(item_path):
                    category_name = item
                    # 初始化该分类
                    if category_name not in categories:
                        categories[category_name] = []
                    
                    # 遍历子文件夹中的音频文件
                    for filename in os.listdir(item_path):
                        if filename.lower().endswith(audio_extensions):
                            file_path = os.path.join(item_path, filename)
                            display_name = os.path.splitext(filename)[0]
                            
                            categories[category_name].append({
                                'name': display_name,
                                'path': file_path,
                                'category': category_name
                            })
                
                # 处理直接放在feature_cache下的音频文件（默认分类为"未分类"）
                elif os.path.isfile(item_path) and item.lower().endswith(audio_extensions):
                    default_category = "未分类"
                    if default_category not in categories:
                        categories[default_category] = []
                    
                    display_name = os.path.splitext(item)[0]
                    categories[default_category].append({
                        'name': display_name,
                        'path': item_path,
                        'category': default_category
                    })
        
        # 对每个分类的音色按名称排序
        for category in categories:
            categories[category].sort(key=lambda x: x['name'])
        
        return jsonify({
            'success': True,
            'categories': categories
        })
        
    except Exception as e:
        app.logger.error(f"获取分类音色列表时出错: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
@app.route('/feature_cache/<path:filename>')
def feature_cache_file(filename):
    """提供feature_cache文件夹中的文件访问"""
    return send_file(os.path.join(app.config['FEATURE_CACHE_FOLDER'], filename))

# ------------------------------
# 静态文件服务（uploads目录，与原后端一致）
# ------------------------------
@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    """提供上传文件的静态访问（对应原后端app.use('/uploads', express.static)）"""
    return send_from_directory(UPLOAD_DIR, filename)


# ------------------------------
# 分类管理API（与原后端完全对应）
# ------------------------------

# 1. 获取所有分类（GET /api/categories）
@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    categories = conn.execute('SELECT * FROM categories ORDER BY id').fetchall()
    conn.close()
    # 转换为字典列表返回（与原后端JSON格式一致）
    return jsonify([dict(cat) for cat in categories])


# 2. 添加新分类（POST /api/categories）
@app.route('/api/categories', methods=['POST'])
def add_category():
    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')

    # 验证参数（与原后端一致：分类名称不能为空）
    if not name:
        return jsonify({"error": "分类名称不能为空"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 插入新分类（与原后端一致）
        cursor.execute(
            'INSERT INTO categories (name, description, created_at) VALUES (?, ?, ?)',
            (name, description, get_current_time())
        )
        conn.commit()
        # 返回新创建的分类（与原后端一致）
        new_cat = cursor.execute('SELECT * FROM categories WHERE id = ?', (cursor.lastrowid,)).fetchone()
        return jsonify(dict(new_cat)), 201

    except sqlite3.IntegrityError as e:
        # 处理分类名称唯一约束（与原后端一致）
        if "UNIQUE constraint failed" in str(e):
            return jsonify({"error": "该分类名称已存在"}), 400
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


# 3. 更新分类（PUT /api/categories/<id>）
@app.route('/api/categories/<int:id>', methods=['PUT'])
def update_category(id):
    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')

    # 验证参数（与原后端一致：分类名称不能为空）
    if not name:
        return jsonify({"error": "分类名称不能为空"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 先检查分类是否存在
        cursor.execute('SELECT * FROM categories WHERE id = ?', (id,))
        if not cursor.fetchone():
            return jsonify({"error": "分类不存在"}), 404

        # 更新分类（与原后端一致）
        cursor.execute(
            'UPDATE categories SET name = ?, description = ? WHERE id = ?',
            (name, description, id)
        )
        conn.commit()

        # 返回更新后的分类（与原后端一致）
        updated_cat = cursor.execute('SELECT * FROM categories WHERE id = ?', (id,)).fetchone()
        return jsonify(dict(updated_cat))

    except sqlite3.IntegrityError as e:
        # 处理分类名称唯一约束（与原后端一致）
        if "UNIQUE constraint failed" in str(e):
            return jsonify({"error": "该分类名称已存在"}), 400
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


# 4. 删除分类（DELETE /api/categories/<id>）
@app.route('/api/categories/<int:id>', methods=['DELETE'])
def delete_category(id):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. 检查分类下是否有音色（与原后端一致：有则不能删）
        cursor.execute('SELECT COUNT(*) as count FROM voices WHERE category_id = ?', (id,))
        result = cursor.fetchone()
        if result['count'] > 0:
            return jsonify({"error": "该分类下仍有音色，无法删除"}), 400

        # 2. 检查分类是否存在
        cursor.execute('DELETE FROM categories WHERE id = ?', (id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "分类不存在"}), 404

        conn.commit()
        return jsonify({"message": "分类删除成功"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


# ------------------------------
# 音色管理API（与原后端完全对应）
# ------------------------------

# 1. 获取所有音色（GET /api/voices，支持筛选、搜索、排序）
@app.route('/api/voices', methods=['GET'])
def get_voices():
    # 获取查询参数（与原后端一致：category、search、sort）
    category = request.args.get('category')  # 分类ID（all表示全部）
    search = request.args.get('search', '')   # 搜索关键词
    sort = request.args.get('sort', 'newest') # 排序方式

    conn = get_db_connection()
    cursor = conn.cursor()

    # 构建SQL查询（与原后端逻辑一致，JOIN分类表获取category_name）
    query = '''
        SELECT v.*, c.name as category_name 
        FROM voices v
        JOIN categories c ON v.category_id = c.id
    '''
    params = []
    conditions = []

    # 1. 分类筛选（与原后端一致：category != 'all'时过滤）
    if category and category != 'all':
        try:
            category_id = int(category)
            conditions.append("v.category_id = ?")
            params.append(category_id)
        except ValueError:
            # 若category不是数字，视为无效筛选
            pass

    # 2. 搜索筛选（与原后端一致：匹配名称、描述、分类名）
    if search:
        search_term = f'%{search}%'
        conditions.append("(v.name LIKE ? OR v.description LIKE ? OR c.name LIKE ?)")
        params.extend([search_term, search_term, search_term])

    # 3. 拼接WHERE条件
    if conditions:
        query += f" WHERE {' AND '.join(conditions)}"

    # 4. 排序逻辑（与原后端完全一致）
    sort_map = {
        'oldest': "v.created_at ASC",
        'name_asc': "v.name ASC",
        'name_desc': "v.name DESC",
        'newest': "v.created_at DESC"  # 默认
    }
    query += f" ORDER BY {sort_map.get(sort, sort_map['newest'])}"

    # 执行查询并返回结果
    voices = cursor.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(voice) for voice in voices])


# 2. 获取单个音色（GET /api/voices/<id>）
@app.route('/api/voices/<int:id>', methods=['GET'])
def get_single_voice(id):
    conn = get_db_connection()
    # 与原后端一致：JOIN分类表返回category_name
    voice = conn.execute('''
        SELECT v.*, c.name as category_name 
        FROM voices v
        JOIN categories c ON v.category_id = c.id
        WHERE v.id = ?
    ''', (id,)).fetchone()
    conn.close()

    if not voice:
        return jsonify({"error": "音色不存在"}), 404
    return jsonify(dict(voice))


# 3. 上传新音色（POST /api/voices，带文件上传）
@app.route('/api/voices', methods=['POST'])
def upload_voice():
    # 1. 获取表单数据（与原后端一致：name、category_id、description）
    name = request.form.get('name')
    category_id = request.form.get('category_id')
    description = request.form.get('description', '')
    # 2. 获取上传文件（与原后端一致：file字段名为'audio'）
    audio_file = request.files.get('audio')

    # 验证必填参数（与原后端一致）
    if not name or not category_id or not audio_file or audio_file.filename == '':
        return jsonify({"error": "请填写所有必填字段并上传音频文件"}), 400

    # 验证分类ID是否为数字
    try:
        category_id = int(category_id)
    except ValueError:
        return jsonify({"error": "分类ID必须为数字"}), 400

    # 验证文件格式（与原后端一致）
    if not allowed_file(audio_file.filename, audio_file.mimetype):
        return jsonify({"error": "只允许上传MP3, WAV或AAC格式的音频文件"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. 检查分类是否存在（与原后端一致）
        cursor.execute('SELECT id, voice_count FROM categories WHERE id = ?', (category_id,))
        category = cursor.fetchone()
        if not category:
            return jsonify({"error": "指定的分类不存在"}), 400

        # 2. 处理文件上传（与原后端一致：UUID生成唯一文件名）
        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{file_ext}"  # 生成唯一文件名
        file_save_path = os.path.join(UPLOAD_DIR, unique_filename)
        audio_file.save(file_save_path)  # 保存文件

        # 3. 获取文件信息（与原后端一致）
        file_size = os.path.getsize(file_save_path)  # 文件大小（字节）
        audio_path = f"/uploads/{unique_filename}"   # 数据库存储的访问路径
        duration = 30.0  # 与原后端一致：暂时硬编码为30秒（实际需音频库计算）

        # 4. 插入音色记录（与原后端一致）
        cursor.execute('''
            INSERT INTO voices (
                name, category_id, description, audio_path, 
                file_size, duration, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (name, category_id, description, audio_path, file_size, duration, get_current_time(), get_current_time()))
        conn.commit()

        # 5. 更新分类的音色数量（与原后端一致）
        new_voice_count = category['voice_count'] + 1
        cursor.execute(
            'UPDATE categories SET voice_count = ? WHERE id = ?',
            (new_voice_count, category_id)
        )
        conn.commit()

        # 6. 返回新创建的音色（与原后端一致）
        new_voice = cursor.execute('''
            SELECT v.*, c.name as category_name 
            FROM voices v
            JOIN categories c ON v.category_id = c.id
            WHERE v.id = ?
        ''', (cursor.lastrowid,)).fetchone()
        return jsonify(dict(new_voice)), 201

    except Exception as e:
        # 异常时删除已上传的文件（避免垃圾文件）
        if 'file_save_path' in locals() and os.path.exists(file_save_path):
            os.remove(file_save_path)
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


# 4. 更新音色（PUT /api/voices/<id>，支持重新上传文件）
@app.route('/api/voices/<int:id>', methods=['PUT'])
def update_voice(id):
    # 1. 获取表单数据（与原后端一致）
    name = request.form.get('name')
    category_id = request.form.get('category_id')
    description = request.form.get('description', '')
    # 2. 获取新上传的文件（可选，与原后端一致）
    new_audio_file = request.files.get('audio')  # 可能为None（不更新文件）

    # 验证必填参数（与原后端一致）
    if not name or not category_id:
        return jsonify({"error": "请填写所有必填字段"}), 400

    # 验证分类ID是否为数字
    try:
        category_id = int(category_id)
    except ValueError:
        return jsonify({"error": "分类ID必须为数字"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. 检查原音色是否存在（与原后端一致）
        cursor.execute('SELECT * FROM voices WHERE id = ?', (id,))
        original_voice = cursor.fetchone()
        if not original_voice:
            return jsonify({"error": "音色不存在"}), 404
        original_voice = dict(original_voice)

        # 2. 检查新分类是否存在（与原后端一致）
        cursor.execute('SELECT id, voice_count FROM categories WHERE id = ?', (category_id,))
        new_category = cursor.fetchone()
        if not new_category:
            return jsonify({"error": "指定的分类不存在"}), 400

        # 3. 处理文件更新（若上传了新文件）
        audio_path = original_voice['audio_path']  # 默认使用原路径
        file_size = original_voice['file_size']    # 默认使用原大小
        duration = original_voice['duration']      # 默认使用原时长
        old_file_path = None  # 原文件路径（用于删除旧文件）

        if new_audio_file and new_audio_file.filename != '':
            # 验证新文件格式（与原后端一致）
            if not allowed_file(new_audio_file.filename, new_audio_file.mimetype):
                return jsonify({"error": "只允许上传MP3, WAV或AAC格式的音频文件"}), 400

            # 生成新文件名并保存（与原后端一致）
            file_ext = os.path.splitext(new_audio_file.filename)[1].lower()
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            new_file_save_path = os.path.join(UPLOAD_DIR, unique_filename)
            new_audio_file.save(new_file_save_path)

            # 更新文件信息
            audio_path = f"/uploads/{unique_filename}"
            file_size = os.path.getsize(new_file_save_path)
            duration = 30.0  # 仍硬编码（与原后端一致）

            # 记录原文件路径（后续删除）
            old_file_path = os.path.join(UPLOAD_DIR, os.path.basename(original_voice['audio_path']))

        # 4. 处理分类切换（若分类ID变化，更新两个分类的音色数量）
        original_category_id = original_voice['category_id']
        if original_category_id != category_id:
            # 减少原分类的音色数量
            cursor.execute('SELECT voice_count FROM categories WHERE id = ?', (original_category_id,))
            old_category = cursor.fetchone()
            if old_category:
                cursor.execute(
                    'UPDATE categories SET voice_count = ? WHERE id = ?',
                    (old_category['voice_count'] - 1, original_category_id)
                )
            # 增加新分类的音色数量
            cursor.execute(
                'UPDATE categories SET voice_count = ? WHERE id = ?',
                (new_category['voice_count'] + 1, category_id)
            )

        # 5. 更新音色记录（与原后端一致）
        cursor.execute('''
            UPDATE voices SET 
                name = ?, 
                category_id = ?, 
                description = ?, 
                audio_path = ?, 
                file_size = ?, 
                duration = ?,
                updated_at = ?
            WHERE id = ?
        ''', (name, category_id, description, audio_path, file_size, duration, get_current_time(), id))
        conn.commit()

        # 6. 删除旧文件（若更新了文件）
        if old_file_path and os.path.exists(old_file_path):
            os.remove(old_file_path)

        # 7. 返回更新后的音色（与原后端一致）
        updated_voice = cursor.execute('''
            SELECT v.*, c.name as category_name 
            FROM voices v
            JOIN categories c ON v.category_id = c.id
            WHERE v.id = ?
        ''', (id,)).fetchone()
        return jsonify(dict(updated_voice))

    except Exception as e:
        # 异常时清理新上传的文件
        if 'new_file_save_path' in locals() and os.path.exists(new_file_save_path):
            os.remove(new_file_save_path)
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


# 5. 删除音色（DELETE /api/voices/<id>）
@app.route('/api/voices/<int:id>', methods=['DELETE'])
def delete_voice(id):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. 检查音色是否存在
        cursor.execute('SELECT * FROM voices WHERE id = ?', (id,))
        voice = cursor.fetchone()
        if not voice:
            return jsonify({"error": "音色不存在"}), 404
        voice = dict(voice)

        # 2. 删除音频文件（与原后端一致）
        audio_file_path = os.path.join(UPLOAD_DIR, os.path.basename(voice['audio_path']))
        if os.path.exists(audio_file_path):
            os.remove(audio_file_path)

        # 3. 更新分类的音色数量（与原后端一致）
        category_id = voice['category_id']
        cursor.execute('SELECT voice_count FROM categories WHERE id = ?', (category_id,))
        category = cursor.fetchone()
        if category:
            new_voice_count = max(0, category['voice_count'] - 1)  # 防止负数
            cursor.execute(
                'UPDATE categories SET voice_count = ? WHERE id = ?',
                (new_voice_count, category_id)
            )

        # 4. 删除音色记录
        cursor.execute('DELETE FROM voices WHERE id = ?', (id,))
        conn.commit()

        return jsonify({"message": "音色删除成功"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


# ------------------------------
# 全局异常处理（文件大小超限等）
# ------------------------------
@app.errorhandler(413)
def request_entity_too_large(error):
    """处理文件大小超限（与原后端50MB限制对应）"""
    return jsonify({"error": "文件大小超过限制（最大50MB）"}), 413
@app.route('/static/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('static/js', filename, mimetype='application/javascript')
@app.route('/static/js/modules/<path:filename>')
def serve_js_modules(filename):
    return send_from_directory('static/js/modules', filename, mimetype='application/javascript')


# 认证验证函数

if __name__ == '__main__':
    app.run(host=cmd_args.host, port=cmd_args.port, threaded=True)
