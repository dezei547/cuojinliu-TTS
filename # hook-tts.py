# hook-tts.py
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# 收集indextts库的所有子模块
hiddenimports = collect_submodules('indextts') + collect_submodules('tools')

# 收集数据文件（模型、音频等）
datas = [
    ('checkpoints', 'checkpoints'),
    ('feature_cache', 'feature_cache'),
    ('templates', 'templates'),
    ('tf_download', 'tf_download')
]