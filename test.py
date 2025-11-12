import argparse
import time
import warnings
from indextts.infer_withpkl import IndexTTS2

# 忽略警告
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

def main():
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="测试使用pkl特征文件生成音频")
    parser.add_argument("--model_dir", type=str, default="./checkpoints", help="模型 checkpoint 目录")
    parser.add_argument("--feature_dir", type=str, default="./feature_cache", help="特征pkl文件目录")
    parser.add_argument("--spk_feature", type=str, required=True, help="说话人特征pkl文件路径")
    parser.add_argument("--text", type=str, required=True, help="要合成的文本")
    parser.add_argument("--output", type=str, default="test_output.wav", help="输出音频文件路径")
    parser.add_argument("--emo_feature", type=str, help="情感特征pkl文件路径（可选）")
    parser.add_argument("--emo_alpha", type=float, default=1.0, help="情感混合比例（0-1之间）")
    parser.add_argument("--fp16", action="store_true", default=True, help="使用FP16加速推理")
    parser.add_argument("--verbose", action="store_true", default=False, help="显示详细日志")
    args = parser.parse_args()
    
    # 初始化TTS模型
    print("初始化TTS模型...")
    start_time = time.time()
    tts = IndexTTS2(
        model_dir=args.model_dir,
        cfg_path=f"{args.model_dir}/config.yaml",
        use_fp16=args.fp16,
        use_deepspeed=True,
        use_cuda_kernel=True,
        feature_cache_dir=args.feature_dir
    )
    print(f"模型初始化完成，耗时: {time.time() - start_time:.2f}秒")
    
    # 生成音频
    print("开始生成音频...")
    start_time = time.time()
    try:
        output_path = tts.infer(
            spk_feature_path=args.spk_feature,
            text=args.text,
            output_path=args.output,
            emo_feature_path=args.emo_feature,
            emo_alpha=args.emo_alpha,
            verbose=args.verbose,
            max_text_tokens_per_segment=120,
            do_sample=True,
            top_p=0.8,
            top_k=30,
            temperature=0.8,
            num_beams=3,
            repetition_penalty=10.0,
            max_mel_tokens=1500
        )
        
        print(f"音频生成完成，耗时: {time.time() - start_time:.2f}秒")
        print(f"生成的音频已保存至: {output_path}")
        
    except Exception as e:
        print(f"生成音频时出错: {str(e)}")

if __name__ == "__main__":
    main()
    